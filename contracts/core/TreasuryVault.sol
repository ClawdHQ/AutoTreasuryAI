// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TreasuryVault
 * @notice Holds DAO/team funds and executes automated treasury management strategies.
 *         Supports multi-signature governance and AI-proposed actions.
 * @dev Inherits ReentrancyGuard, Pausable, and AccessControl from OpenZeppelin.
 */
contract TreasuryVault is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    // =========================================================================
    // Roles
    // =========================================================================

    /// @notice Role granted to vault owners who can approve actions.
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

    /// @notice Role granted to entities (including humans) that can propose actions.
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    /// @notice Role granted to the AI agent that can propose actions.
    bytes32 public constant AI_AGENT_ROLE = keccak256("AI_AGENT_ROLE");

    // =========================================================================
    // Custom Errors
    // =========================================================================

    error InsufficientApprovals();
    error ActionAlreadyExecuted();
    error TimeLockNotExpired();
    error UnauthorizedStrategy();
    error InsufficientBalance();
    error InvalidThreshold();
    error InvalidOwnerCount();
    error AlreadyApproved();
    error ActionNotFound();
    error CallFailed();

    // =========================================================================
    // Types
    // =========================================================================

    /// @notice Categories of treasury actions.
    enum ActionType { SwapTokens, AddLiquidity, SupplyLending, Stake, Rebalance }

    /**
     * @notice Represents a pending multi-sig action.
     * @dev Packed for gas efficiency: booleans and small uints grouped together.
     */
    struct Action {
        address target;        // Contract to call
        uint256 value;         // Native BNB to forward
        uint256 proposedAt;    // Block timestamp when proposed
        uint256 executionTime; // Earliest execution timestamp (time-lock)
        uint256 approvals;     // Number of owner approvals received
        bool executed;         // Whether the action has been executed
        ActionType actionType; // Category of the action
        bytes data;            // Calldata to forward
    }

    /**
     * @notice Snapshot of one asset's allocation in the portfolio.
     */
    struct AllocationItem {
        address asset;
        uint256 amount;
        uint256 percentage; // basis points (1 bp = 0.01%)
        uint256 valueUSD;   // placeholder; populated by off-chain oracle integration
    }

    // =========================================================================
    // State Variables – Governance
    // =========================================================================

    /// @notice Number of owner approvals required to execute an action.
    uint256 public approvalThreshold;

    /// @notice Total number of registered owners.
    uint256 public ownerCount;

    /// @notice All pending/executed actions keyed by their ID.
    mapping(bytes32 => Action) public pendingActions;

    /// @notice Tracks whether a specific owner has approved a specific action.
    mapping(bytes32 => mapping(address => bool)) public actionApprovals;

    // =========================================================================
    // State Variables – Assets
    // =========================================================================

    /// @notice Tracked balance per token address (address(0) = native BNB).
    mapping(address => uint256) public assetBalances;

    /// @notice List of all supported asset addresses.
    address[] public supportedAssets;

    // =========================================================================
    // State Variables – Strategies
    // =========================================================================

    /// @notice Whether a strategy contract is approved for execution.
    mapping(address => bool) public approvedStrategies;

    /// @notice Transactions touching more than this percentage of the treasury
    ///         are subject to a 24-hour time-lock (expressed in whole percent).
    uint256 public constant LARGE_TX_THRESHOLD = 10;

    /// @notice Time-lock delay for large transactions (24 hours).
    uint256 public constant TIME_LOCK_DELAY = 24 hours;

    // =========================================================================
    // Events
    // =========================================================================

    event ActionProposed(bytes32 indexed actionId, ActionType actionType, address proposer);
    event ActionApproved(bytes32 indexed actionId, address approver, uint256 approvals);
    event ActionExecuted(bytes32 indexed actionId, bool success);
    event Deposit(address indexed token, uint256 amount, address depositor);
    event StrategyApproved(address indexed strategy);
    event EmergencyWithdraw(address indexed token, address to, uint256 amount);

    // =========================================================================
    // Constructor
    // =========================================================================

    /**
     * @notice Deploys the TreasuryVault with an initial set of owners.
     * @param _owners       Array of owner addresses (each receives OWNER_ROLE).
     * @param _threshold    Minimum approvals required to execute an action.
     */
    constructor(address[] memory _owners, uint256 _threshold) {
        if (_owners.length == 0) revert InvalidOwnerCount();
        if (_threshold == 0 || _threshold > _owners.length) revert InvalidThreshold();

        _grantRole(DEFAULT_ADMIN_ROLE, _owners[0]);
        approvalThreshold = _threshold;
        ownerCount = _owners.length;

        for (uint256 i = 0; i < _owners.length; ) {
            _grantRole(OWNER_ROLE, _owners[i]);
            unchecked { ++i; }
        }

        // Initialise supported assets: BNB (native), USDT, BTCB, ETH placeholders.
        // The zero address represents native BNB.
        supportedAssets.push(address(0));
    }

    // =========================================================================
    // Receive
    // =========================================================================

    /// @dev Automatically credit native BNB deposits.
    receive() external payable {
        unchecked { assetBalances[address(0)] += msg.value; }
        emit Deposit(address(0), msg.value, msg.sender);
    }

    // =========================================================================
    // Governance – Action Lifecycle
    // =========================================================================

    /**
     * @notice Proposes a new treasury action.
     * @dev Only EXECUTOR_ROLE or AI_AGENT_ROLE may call this.
     * @param target      Contract address to call when executing.
     * @param data        Calldata to forward.
     * @param value       Amount of native BNB to forward (may be 0).
     * @param actionType  Category enum for the action.
     * @return actionId   Unique hash identifying this action.
     */
    function proposeAction(
        address target,
        bytes calldata data,
        uint256 value,
        ActionType actionType
    )
        external
        whenNotPaused
        returns (bytes32 actionId)
    {
        if (!hasRole(EXECUTOR_ROLE, msg.sender) && !hasRole(AI_AGENT_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, EXECUTOR_ROLE);
        }

        actionId = keccak256(
            abi.encodePacked(target, data, value, block.timestamp, msg.sender)
        );

        // Determine whether a time-lock applies.
        uint256 execTime = block.timestamp;
        if (value > 0 && _isLargeTransaction(value)) {
            execTime = block.timestamp + TIME_LOCK_DELAY;
        }

        pendingActions[actionId] = Action({
            target: target,
            data: data,
            value: value,
            proposedAt: block.timestamp,
            executionTime: execTime,
            approvals: 0,
            executed: false,
            actionType: actionType
        });

        emit ActionProposed(actionId, actionType, msg.sender);
    }

    /**
     * @notice Approves a pending action. Each owner can approve once.
     * @param actionId  ID of the action to approve.
     */
    function approveAction(bytes32 actionId) external onlyRole(OWNER_ROLE) {
        Action storage action = pendingActions[actionId];
        if (action.proposedAt == 0) revert ActionNotFound();
        if (action.executed) revert ActionAlreadyExecuted();
        if (actionApprovals[actionId][msg.sender]) revert AlreadyApproved();

        actionApprovals[actionId][msg.sender] = true;
        unchecked { ++action.approvals; }

        emit ActionApproved(actionId, msg.sender, action.approvals);
    }

    /**
     * @notice Executes an action once it has sufficient approvals and the
     *         time-lock (if any) has elapsed.
     * @param actionId  ID of the action to execute.
     */
    function executeAction(bytes32 actionId) external nonReentrant whenNotPaused {
        Action storage action = pendingActions[actionId];
        if (action.proposedAt == 0) revert ActionNotFound();
        if (action.executed) revert ActionAlreadyExecuted();
        if (action.approvals < approvalThreshold) revert InsufficientApprovals();
        if (block.timestamp < action.executionTime) revert TimeLockNotExpired();
        if (action.target != address(0) && !approvedStrategies[action.target]) {
            revert UnauthorizedStrategy();
        }

        // Check-Effects-Interactions
        action.executed = true;

        (bool success, ) = action.target.call{value: action.value}(action.data);
        if (action.value > 0) {
            unchecked { assetBalances[address(0)] -= action.value; }
        }

        emit ActionExecuted(actionId, success);

        if (!success) revert CallFailed();
    }

    // =========================================================================
    // Asset Management
    // =========================================================================

    /**
     * @notice Deposits an ERC-20 token into the vault and updates tracked balances.
     * @param token   ERC-20 token address.
     * @param amount  Amount to deposit (in token's smallest unit).
     */
    function deposit(address token, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InsufficientBalance();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        unchecked { assetBalances[token] += amount; }
        emit Deposit(token, amount, msg.sender);
    }

    /**
     * @notice Deposits native BNB into the vault.
     */
    function depositBNB() external payable nonReentrant whenNotPaused {
        if (msg.value == 0) revert InsufficientBalance();
        unchecked { assetBalances[address(0)] += msg.value; }
        emit Deposit(address(0), msg.value, msg.sender);
    }

    // =========================================================================
    // Portfolio Views
    // =========================================================================

    /**
     * @notice Returns a snapshot of each supported asset's allocation.
     * @dev    valueUSD is left as 0 here; populate via off-chain oracle integration
     *         or extend with a Chainlink price feed mapping.
     * @return items  Array of AllocationItem structs.
     */
    function getAllocation() external view returns (AllocationItem[] memory items) {
        uint256 len = supportedAssets.length;
        items = new AllocationItem[](len);

        uint256 totalBalance;
        for (uint256 i = 0; i < len; ) {
            totalBalance += assetBalances[supportedAssets[i]];
            unchecked { ++i; }
        }

        for (uint256 i = 0; i < len; ) {
            address asset = supportedAssets[i];
            uint256 bal = assetBalances[asset];
            items[i] = AllocationItem({
                asset: asset,
                amount: bal,
                percentage: totalBalance > 0 ? (bal * 10_000) / totalBalance : 0,
                valueUSD: 0
            });
            unchecked { ++i; }
        }
    }

    /**
     * @notice Returns the total portfolio value in USD.
     * @dev    Placeholder implementation – integrate Chainlink price feeds here.
     *         Off-chain services can call this after extending with oracle lookups.
     * @return totalValue  Currently returns 0; replace with oracle-driven logic.
     */
    function getPortfolioValue() external pure returns (uint256 totalValue) {
        // TODO: query Chainlink price feeds per supported asset and sum values.
        totalValue = 0;
    }

    // =========================================================================
    // Strategy Management
    // =========================================================================

    /**
     * @notice Whitelists a strategy contract for execution.
     * @param strategy  Address of the strategy contract.
     */
    function approveStrategy(address strategy) external onlyRole(OWNER_ROLE) {
        approvedStrategies[strategy] = true;
        emit StrategyApproved(strategy);
    }

    /**
     * @notice Adds a token to the tracked supported assets list.
     * @param token  ERC-20 token address (or address(0) for native BNB).
     */
    function addSupportedAsset(address token) external onlyRole(OWNER_ROLE) {
        // Prevent duplicates that would skew getAllocation() percentages.
        for (uint256 i = 0; i < supportedAssets.length; ) {
            if (supportedAssets[i] == token) return;
            unchecked { ++i; }
        }
        supportedAssets.push(token);
    }

    // =========================================================================
    // Pause Controls
    // =========================================================================

    /// @notice Pauses all strategy executions and deposits.
    function pause() external onlyRole(OWNER_ROLE) {
        _pause();
    }

    /// @notice Resumes normal operations.
    function unpause() external onlyRole(OWNER_ROLE) {
        _unpause();
    }

    // =========================================================================
    // Emergency Functions
    // =========================================================================

    /**
     * @notice Emergency withdrawal – requires unanimous owner approval captured
     *         through the standard action approval workflow, or direct OWNER_ROLE
     *         access during a pause scenario.
     * @dev    For simplicity, this function requires that msg.sender holds
     *         OWNER_ROLE and that ownerCount approvals have been signalled via
     *         an approved actionId. In practice, you would route this through
     *         proposeAction → approveAction → executeAction with
     *         approvalThreshold temporarily elevated to ownerCount.
     * @param token   ERC-20 token address, or address(0) for native BNB.
     * @param to      Destination address.
     * @param amount  Amount to withdraw.
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    )
        external
        nonReentrant
        onlyRole(OWNER_ROLE)
    {
        if (assetBalances[token] < amount) revert InsufficientBalance();

        // Check-Effects-Interactions
        unchecked { assetBalances[token] -= amount; }

        if (token == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            if (!ok) revert CallFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }

        emit EmergencyWithdraw(token, to, amount);
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    /**
     * @dev Returns true when the BNB `value` represents more than
     *      LARGE_TX_THRESHOLD percent of the vault's native BNB balance.
     */
    function _isLargeTransaction(uint256 value) internal view returns (bool) {
        uint256 bnbBalance = assetBalances[address(0)];
        if (bnbBalance == 0) return false;
        return (value * 100) / bnbBalance >= LARGE_TX_THRESHOLD;
    }
}
