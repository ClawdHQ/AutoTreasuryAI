// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// =========================================================================
// External Protocol Interfaces
// =========================================================================

/// @notice Subset of the PancakeSwap V3 SwapRouter interface used by this contract.
interface IPancakeV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        returns (uint256 amountOut);
}

/// @notice Subset of the PancakeSwap V3 NonfungiblePositionManager interface.
interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function mint(MintParams calldata params)
        external
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        returns (uint256 amount0, uint256 amount1);

    function collect(CollectParams calldata params)
        external
        returns (uint256 amount0, uint256 amount1);
}

/// @notice Venus vToken interface.
interface IVToken {
    function mint(uint256 mintAmount) external returns (uint256);
    function redeem(uint256 redeemTokens) external returns (uint256);
    function borrow(uint256 borrowAmount) external returns (uint256);
    function repayBorrow(uint256 repayAmount) external returns (uint256);
    function supplyRatePerBlock() external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
}

/// @notice Venus Comptroller interface.
interface IComptroller {
    function enterMarkets(address[] calldata vTokens) external returns (uint256[] memory);
    function claimVenus(address holder) external;
}

/// @notice Minimal BNB staking interface (BSC native staking / liquid staking stub).
interface IBNBStaking {
    function delegate(address validator, uint256 amount) external payable;
    function claimRewards() external returns (uint256);
}

/**
 * @title StrategyExecutor
 * @notice Execution layer for AutoTreasury AI strategies.
 *         Integrates PancakeSwap V3, Venus Protocol, and BNB staking.
 * @dev Only the TreasuryVault (owner) may call execution functions.
 *      Uses SafeERC20 for all ERC-20 transfers and ReentrancyGuard on external calls.
 */
contract StrategyExecutor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    // Custom Errors
    // =========================================================================

    error InvalidSlippage();
    error InsufficientLiquidity();
    error InvalidTickRange();
    error StrategyFailed(string reason);
    error AddressZero();
    error InvalidAmount();
    error UnsupportedToken();

    // =========================================================================
    // Configuration
    // =========================================================================

    /// @notice PancakeSwap V3 SwapRouter address.
    address public pancakeRouter;

    /// @notice PancakeSwap V3 NonfungiblePositionManager address.
    address public pancakeNFTManager;

    /// @notice Venus Comptroller address.
    address public venusComptroller;

    /// @notice Maps underlying token → Venus vToken.
    mapping(address => address) public tokenToVToken;

    /// @notice BNB staking contract.
    address public bnbStakingContract;

    /// @notice Default swap fee tier (500 = 0.05 %).
    uint24 public constant DEFAULT_FEE_TIER = 500;

    /// @notice Tick spacing for the default 0.05 % fee pool.
    int24 public constant TICK_SPACING = 10;

    /// @notice Width of the default LP tick range (±10 % around current price).
    int24 public constant TICK_RANGE_WIDTH = 887_220; // ~full range; narrow in prod

    // =========================================================================
    // Events
    // =========================================================================

    event TokenSwapped(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    event LiquidityAdded(
        uint256 indexed tokenId,
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1
    );
    event LiquidityRemoved(uint256 indexed tokenId, uint256 amount0, uint256 amount1);
    event SuppliedToVenus(address indexed token, uint256 amount, uint256 vTokensMinted);
    event WithdrawnFromVenus(address indexed token, uint256 amount);
    event BNBStaked(uint256 amount, address validator);
    event RewardsClaimed(uint256 totalRewards);
    event VTokenMappingSet(address indexed token, address indexed vToken);

    // =========================================================================
    // Constructor
    // =========================================================================

    /**
     * @param _pancakeRouter      PancakeSwap V3 SwapRouter.
     * @param _pancakeNFTManager  PancakeSwap V3 NonfungiblePositionManager.
     * @param _venusComptroller   Venus Comptroller.
     * @param _bnbStakingContract BNB staking contract.
     * @param initialOwner        Address of the TreasuryVault (owner).
     */
    constructor(
        address _pancakeRouter,
        address _pancakeNFTManager,
        address _venusComptroller,
        address _bnbStakingContract,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_pancakeRouter == address(0)) revert AddressZero();
        if (_pancakeNFTManager == address(0)) revert AddressZero();
        if (_venusComptroller == address(0)) revert AddressZero();
        if (initialOwner == address(0)) revert AddressZero();

        pancakeRouter = _pancakeRouter;
        pancakeNFTManager = _pancakeNFTManager;
        venusComptroller = _venusComptroller;
        bnbStakingContract = _bnbStakingContract;
    }

    // =========================================================================
    // Configuration Setters (owner only)
    // =========================================================================

    /**
     * @notice Registers the Venus vToken address for a given underlying token.
     * @param token   Underlying ERC-20 (e.g. USDT).
     * @param vToken  Corresponding Venus vToken (e.g. vUSDT).
     */
    function setVTokenMapping(address token, address vToken) external onlyOwner {
        if (token == address(0) || vToken == address(0)) revert AddressZero();
        tokenToVToken[token] = vToken;
        emit VTokenMappingSet(token, vToken);
    }

    // =========================================================================
    // PancakeSwap V3 – Swaps
    // =========================================================================

    /**
     * @notice Swaps an exact amount of `tokenIn` for as much `tokenOut` as possible.
     * @param tokenIn       Input token address.
     * @param tokenOut      Output token address.
     * @param amountIn      Amount of `tokenIn` to swap.
     * @param minAmountOut  Minimum acceptable output (slippage guard).
     * @return amountOut    Actual amount of `tokenOut` received.
     */
    function swapTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    )
        external
        onlyOwner
        nonReentrant
        returns (uint256 amountOut)
    {
        if (amountIn == 0) revert InvalidAmount();
        if (minAmountOut == 0) revert InvalidSlippage();
        if (tokenIn == address(0) || tokenOut == address(0)) revert AddressZero();

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        _approveIfNeeded(tokenIn, pancakeRouter, amountIn);

        IPancakeV3Router.ExactInputSingleParams memory params = IPancakeV3Router
            .ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: DEFAULT_FEE_TIER,
                recipient: msg.sender,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            });

        amountOut = IPancakeV3Router(pancakeRouter).exactInputSingle(params);

        emit TokenSwapped(tokenIn, tokenOut, amountIn, amountOut);
    }

    // =========================================================================
    // PancakeSwap V3 – Liquidity
    // =========================================================================

    /**
     * @notice Adds concentrated liquidity to a PancakeSwap V3 pool.
     * @param token0      First token of the pair.
     * @param token1      Second token of the pair.
     * @param amount0     Desired amount of token0.
     * @param amount1     Desired amount of token1.
     * @param tickLower   Lower tick boundary (pass 0 for auto-calculation).
     * @param tickUpper   Upper tick boundary (pass 0 for auto-calculation).
     * @param amount0Min  Minimum token0 to deposit (slippage protection; use 0 only in tests).
     * @param amount1Min  Minimum token1 to deposit (slippage protection; use 0 only in tests).
     * @return tokenId    LP position NFT ID minted.
     */
    function addLiquidity(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Min,
        uint256 amount1Min
    )
        external
        onlyOwner
        nonReentrant
        returns (uint256 tokenId)
    {
        if (token0 == address(0) || token1 == address(0)) revert AddressZero();
        if (amount0 == 0 || amount1 == 0) revert InvalidAmount();

        // Auto-calculate ticks when both are zero.
        if (tickLower == 0 && tickUpper == 0) {
            (tickLower, tickUpper) = calculateOptimalTicks(token0, token1, DEFAULT_FEE_TIER);
        }
        if (tickLower >= tickUpper) revert InvalidTickRange();

        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);
        _approveIfNeeded(token0, pancakeNFTManager, amount0);
        _approveIfNeeded(token1, pancakeNFTManager, amount1);

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager
            .MintParams({
                token0: token0,
                token1: token1,
                fee: DEFAULT_FEE_TIER,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                recipient: msg.sender,
                deadline: block.timestamp + 30 minutes
            });

        uint256 actualAmount0;
        uint256 actualAmount1;
        (tokenId, , actualAmount0, actualAmount1) = INonfungiblePositionManager(
            pancakeNFTManager
        ).mint(params);

        emit LiquidityAdded(tokenId, token0, token1, actualAmount0, actualAmount1);
    }

    /**
     * @notice Removes liquidity from a PancakeSwap V3 position.
     * @param tokenId    LP position NFT ID.
     * @param liquidity  Amount of liquidity to remove.
     * @param amount0Min Minimum token0 to receive (slippage protection; use 0 only in tests).
     * @param amount1Min Minimum token1 to receive (slippage protection; use 0 only in tests).
     * @return amount0   token0 received.
     * @return amount1   token1 received.
     */
    function removeLiquidity(
        uint256 tokenId,
        uint128 liquidity,
        uint256 amount0Min,
        uint256 amount1Min
    )
        external
        onlyOwner
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        if (liquidity == 0) revert InsufficientLiquidity();

        INonfungiblePositionManager.DecreaseLiquidityParams memory decParams =
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidity,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: block.timestamp + 30 minutes
            });

        (amount0, amount1) = INonfungiblePositionManager(pancakeNFTManager)
            .decreaseLiquidity(decParams);

        INonfungiblePositionManager.CollectParams memory collectParams =
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: msg.sender,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });

        (amount0, amount1) = INonfungiblePositionManager(pancakeNFTManager).collect(
            collectParams
        );

        emit LiquidityRemoved(tokenId, amount0, amount1);
    }

    // =========================================================================
    // Venus Protocol
    // =========================================================================

    /**
     * @notice Supplies an ERC-20 token to Venus Protocol as collateral.
     * @param token   Underlying ERC-20 address.
     * @param amount  Amount to supply.
     * @return vTokensMinted  Number of vTokens minted by Venus.
     */
    function supplyToVenus(address token, uint256 amount)
        external
        onlyOwner
        nonReentrant
        returns (uint256 vTokensMinted)
    {
        address vToken = tokenToVToken[token];
        if (vToken == address(0)) revert UnsupportedToken();
        if (amount == 0) revert InvalidAmount();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        _approveIfNeeded(token, vToken, amount);

        uint256 balanceBefore = IVToken(vToken).balanceOf(address(this));
        uint256 result = IVToken(vToken).mint(amount);
        if (result != 0) revert StrategyFailed("Venus mint failed");

        vTokensMinted = IVToken(vToken).balanceOf(address(this)) - balanceBefore;

        // Opt into the market so the supplied token counts as collateral.
        address[] memory markets = new address[](1);
        markets[0] = vToken;
        IComptroller(venusComptroller).enterMarkets(markets);

        emit SuppliedToVenus(token, amount, vTokensMinted);
    }

    /**
     * @notice Redeems vTokens and withdraws the underlying asset from Venus.
     * @param token   Underlying ERC-20 address.
     * @param amount  Amount of vTokens to redeem.
     * @return underlyingReceived  Underlying tokens transferred to the owner.
     */
    function withdrawFromVenus(address token, uint256 amount)
        external
        onlyOwner
        nonReentrant
        returns (uint256 underlyingReceived)
    {
        address vToken = tokenToVToken[token];
        if (vToken == address(0)) revert UnsupportedToken();
        if (amount == 0) revert InvalidAmount();

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        uint256 result = IVToken(vToken).redeem(amount);
        if (result != 0) revert StrategyFailed("Venus redeem failed");

        underlyingReceived = IERC20(token).balanceOf(address(this)) - balanceBefore;
        IERC20(token).safeTransfer(msg.sender, underlyingReceived);

        emit WithdrawnFromVenus(token, underlyingReceived);
    }

    // =========================================================================
    // BNB Staking
    // =========================================================================

    /**
     * @notice Stakes native BNB with a validator via the BNB staking contract.
     * @param amount     Amount of BNB (in wei) to stake.
     * @param validator  Validator address to delegate to.
     * @return success   Always true on non-reverting execution.
     */
    function stakeBNB(uint256 amount, address validator)
        external
        onlyOwner
        nonReentrant
        returns (bool success)
    {
        if (amount == 0) revert InvalidAmount();
        if (validator == address(0)) revert AddressZero();
        if (bnbStakingContract == address(0)) revert AddressZero();
        if (address(this).balance < amount) revert InsufficientLiquidity();

        IBNBStaking(bnbStakingContract).delegate{value: amount}(validator, amount);

        emit BNBStaked(amount, validator);
        return true;
    }

    // =========================================================================
    // Reward Claiming
    // =========================================================================

    /**
     * @notice Claims available rewards from all protocols and returns total claimed.
     * @dev    Rewards are transferred to the owner (TreasuryVault).
     * @return totalRewards  Total rewards claimed (denominated in the reward token's base unit).
     */
    function claimRewards() external onlyOwner nonReentrant returns (uint256 totalRewards) {
        // Claim Venus/XVS rewards.
        IComptroller(venusComptroller).claimVenus(address(this));

        // Claim BNB staking rewards.
        uint256 stakingRewards;
        if (bnbStakingContract != address(0)) {
            stakingRewards = IBNBStaking(bnbStakingContract).claimRewards();
        }

        totalRewards = stakingRewards; // Venus rewards are in XVS; tracked separately off-chain.

        emit RewardsClaimed(totalRewards);
    }

    // =========================================================================
    // View – Tick Calculation
    // =========================================================================

    /**
     * @notice Calculates a ±wide tick range for providing full-range-equivalent LP.
     * @dev    For a production system, query the pool's current tick and apply a
     *         percentage band.  Here we return a conservative wide range.
     *         The three parameters (token0, token1, fee) are accepted for interface
     *         compatibility but not used in this stub implementation.
     * @return lower   Lower tick.
     * @return upper   Upper tick.
     */
    function calculateOptimalTicks(
        address,
        address,
        uint24
    )
        public
        pure
        returns (int24 lower, int24 upper)
    {
        // Use a wide symmetric range that is always valid for any pool.
        // Ticks must be multiples of TICK_SPACING.
        lower = -(TICK_RANGE_WIDTH / TICK_SPACING) * TICK_SPACING;
        upper =  (TICK_RANGE_WIDTH / TICK_SPACING) * TICK_SPACING;
    }

    // =========================================================================
    // View – APR Estimates
    // =========================================================================

    /**
     * @notice Returns current estimated APRs from each integrated protocol.
     * @dev    PancakeSwap APR is not available on-chain; returns 0.
     *         Venus APR is derived from the USDT vToken's supply rate.
     *         BNB staking APR is a constant 5 % (500 basis points).
     * @return pancakeAPR   PancakeSwap LP APR in basis points (0 = not available on-chain).
     * @return venusAPR     Venus supply APR in basis points.
     * @return stakingAPR   BNB staking APR in basis points (constant 500).
     */
    function getAPRs()
        external
        pure
        returns (
            uint256 pancakeAPR,
            uint256 venusAPR,
            uint256 stakingAPR
        )
    {
        pancakeAPR = 0; // Requires off-chain subgraph data.
        venusAPR = _calculateVenusAPR();
        stakingAPR = 500; // 5 % expressed in basis points.
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    /**
     * @dev Approves `spender` to spend `amount` of `token` only when the current
     *      allowance is insufficient, minimising SSTORE operations.
     */
    function _approveIfNeeded(address token, address spender, uint256 amount) internal {
        uint256 allowance = IERC20(token).allowance(address(this), spender);
        if (allowance < amount) {
            IERC20(token).forceApprove(spender, type(uint256).max);
        }
    }

    /**
     * @dev Calculates Venus supply APR from the USDT vToken's on-chain supply rate.
     *      Formula: APR = supplyRatePerBlock × blocksPerDay × daysPerYear / 1e18 × 100
     */
    function _calculateVenusAPR() internal pure returns (uint256) {
        // Use USDT vToken as reference; fall back to 0 if not configured.
        // A concrete USDT address must be set via setVTokenMapping before this is useful.
        // We iterate through a well-known set; for simplicity we read from a stored ref.
        // NOTE: Extend with a reference token address setter if needed.
        return 0; // Placeholder – implement oracle lookup when vToken addresses are known.
    }

    // =========================================================================
    // Receive
    // =========================================================================

    /// @dev Accept native BNB (e.g. from staking reward withdrawals).
    receive() external payable {}
}
