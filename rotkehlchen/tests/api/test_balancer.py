import random
import warnings as test_warnings
from contextlib import ExitStack
from http import HTTPStatus

import pytest
import requests

from rotkehlchen.accounting.structures import Balance
from rotkehlchen.assets.asset import EthereumToken
from rotkehlchen.assets.unknown_asset import UnknownEthereumToken
from rotkehlchen.chain.ethereum.modules.balancer.typing import (
    BalancerBPTEventPoolToken,
    BalancerBPTEventType,
    BalancerEvent,
    BalancerPoolEventsBalance,
)
from rotkehlchen.chain.ethereum.trades import AMMSwap, AMMTrade
from rotkehlchen.chain.ethereum.typing import string_to_ethereum_address
from rotkehlchen.constants import ZERO
from rotkehlchen.fval import FVal
from rotkehlchen.tests.utils.api import (
    api_url_for,
    assert_error_response,
    assert_ok_async_response,
    assert_proper_response_with_result,
    wait_for_async_task,
)
from rotkehlchen.tests.utils.rotkehlchen import setup_balances
from rotkehlchen.typing import AssetAmount, Location, Price, Timestamp, TradeType

# Top holder of WBTC-WETH pool (0x1eff8af5d577060ba4ac8a29a13525bb0ee2a3d5)
BALANCER_TEST_ADDR1 = string_to_ethereum_address('0x49a2DcC237a65Cc1F412ed47E0594602f6141936')
BALANCER_TEST_ADDR2 = string_to_ethereum_address('0x029f388aC4D5C8BfF490550ce0853221030E822b')
BALANCER_TEST_ADDR3 = string_to_ethereum_address('0x7716a99194d758c8537F056825b75Dd0C8FDD89f')
BALANCER_TEST_ADDR3_POOL1 = string_to_ethereum_address('0x59A19D8c652FA0284f44113D0ff9aBa70bd46fB4')  # noqa: E501
BALANCER_TEST_ADDR3_POOL2 = string_to_ethereum_address('0x574FdB861a0247401B317a3E68a83aDEAF758cf6')  # noqa: E501
BALANCER_TEST_ADDR3_POOL3 = string_to_ethereum_address('0x01d5314Ca775a0Ec2Ed11b19Ff745a08d9D3C7F9')  # noqa: E501


@pytest.mark.parametrize('ethereum_accounts', [[BALANCER_TEST_ADDR1]])
@pytest.mark.parametrize('ethereum_modules', [['uniswap']])
@pytest.mark.parametrize('start_with_valid_premium', [True])
def test_get_balancer_module_not_activated(
        rotkehlchen_api_server,
        ethereum_accounts,  # pylint: disable=unused-argument
):
    response = requests.get(
        api_url_for(rotkehlchen_api_server, 'balancerbalancesresource'),
    )
    assert_error_response(
        response=response,
        contained_in_msg='balancer module is not activated',
        status_code=HTTPStatus.CONFLICT,
    )


@pytest.mark.parametrize('ethereum_accounts', [[BALANCER_TEST_ADDR1]])
@pytest.mark.parametrize('ethereum_modules', [['balancer']])
@pytest.mark.parametrize('start_with_valid_premium', [True])
def test_get_balances(
        rotkehlchen_api_server,
        ethereum_accounts,  # pylint: disable=unused-argument
        rotki_premium_credentials,  # pylint: disable=unused-argument
        start_with_valid_premium,  # pylint: disable=unused-argument
):
    """Test get the balances for premium users works as expected"""
    async_query = random.choice([False, True])
    rotki = rotkehlchen_api_server.rest_api.rotkehlchen
    setup = setup_balances(
        rotki,
        ethereum_accounts=ethereum_accounts,
        btc_accounts=None,
        original_queries=['zerion', 'logs', 'blocknobytime'],
    )
    with ExitStack() as stack:
        # patch ethereum/etherscan to not autodetect tokens
        setup.enter_ethereum_patches(stack)
        response = requests.get(api_url_for(
            rotkehlchen_api_server, 'balancerbalancesresource'),
            json={'async_query': async_query},
        )
        if async_query:
            task_id = assert_ok_async_response(response)
            outcome = wait_for_async_task(rotkehlchen_api_server, task_id)
            assert outcome['message'] == ''
            result = outcome['result']
        else:
            result = assert_proper_response_with_result(response)

    if len(result) != 1:
        test_warnings.warn(
            UserWarning(f'Test account {BALANCER_TEST_ADDR1} has no balances'),
        )
        return

    for pool_share in result[BALANCER_TEST_ADDR1]:
        assert pool_share['address'] is not None
        assert FVal(pool_share['total_amount']) >= ZERO
        assert FVal(pool_share['user_balance']['amount']) >= ZERO
        assert FVal(pool_share['user_balance']['usd_value']) >= ZERO

        for pool_token in pool_share['tokens']:
            assert pool_token['token'] is not None
            # UnknownEthereumToken
            if isinstance(pool_token['token'], dict):
                assert pool_token['token']['ethereum_address'] is not None
                assert pool_token['token']['name'] is not None
                assert pool_token['token']['symbol'] is not None

            assert pool_token['total_amount'] is not None
            assert FVal(pool_token['user_balance']['amount']) >= ZERO
            assert FVal(pool_token['user_balance']['usd_value']) >= ZERO
            assert FVal(pool_token['usd_price']) >= ZERO
            assert FVal(pool_token['weight']) >= ZERO


BALANCER_TEST_ADDR2_EXPECTED_TRADES = [
    AMMTrade(
        trade_type=TradeType.BUY,
        base_asset=EthereumToken('WETH'),
        quote_asset=EthereumToken('AAVE'),
        amount=AssetAmount(FVal('1.616934038985744521')),
        rate=Price(FVal('0.1435961933076020882129179755')),
        trade_index=1,
        swaps=[
            AMMSwap(
                tx_hash='0x3c457da9b541ae39a7dc781ab04a03938b98b5649512aec2a2d32635c9bbf589',  # noqa: E501
                log_index=24,
                address=string_to_ethereum_address('0x029f388aC4D5C8BfF490550ce0853221030E822b'),  # noqa: E501
                from_address=string_to_ethereum_address('0x0000000000007F150Bd6f54c40A34d7C3d5e9f56'),  # noqa: E501
                to_address=string_to_ethereum_address('0x7c90a3cd7Ec80dd2F633ed562480AbbEEd3bE546'),  # noqa: E501
                timestamp=Timestamp(1607008178),
                location=Location.BALANCER,
                token0=EthereumToken('AAVE'),
                token1=EthereumToken('WETH'),
                amount0_in=AssetAmount(FVal('11.260284842802604032')),
                amount1_in=AssetAmount(ZERO),
                amount0_out=AssetAmount(ZERO),
                amount1_out=AssetAmount(FVal('1.616934038985744521')),
            ),
        ],
    ),
    AMMTrade(
        trade_type=TradeType.BUY,
        base_asset=EthereumToken('AAVE'),
        quote_asset=EthereumToken('WETH'),
        amount=AssetAmount(FVal('11.260286362820602094')),
        rate=Price(FVal('7.061804774312194764662462992')),
        trade_index=0,
        swaps=[
            AMMSwap(
                tx_hash='0x3c457da9b541ae39a7dc781ab04a03938b98b5649512aec2a2d32635c9bbf589',  # noqa: E501
                log_index=18,
                address=string_to_ethereum_address('0x029f388aC4D5C8BfF490550ce0853221030E822b'),  # noqa: E501
                from_address=string_to_ethereum_address('0x0000000000007F150Bd6f54c40A34d7C3d5e9f56'),  # noqa: E501
                to_address=string_to_ethereum_address('0x70985E557aE0CD6dC88189a532e54FbC61927BAd'),  # noqa: E501
                timestamp=Timestamp(1607008178),
                location=Location.BALANCER,
                token0=EthereumToken('WETH'),
                token1=EthereumToken('AAVE'),
                amount0_in=AssetAmount(FVal('1.594533794502600192')),
                amount1_in=AssetAmount(ZERO),
                amount0_out=AssetAmount(ZERO),
                amount1_out=AssetAmount(FVal('11.260286362820602094')),
            ),
        ],
    ),
    AMMTrade(
        trade_type=TradeType.BUY,
        base_asset=EthereumToken('WETH'),
        quote_asset=EthereumToken('SYN'),
        amount=AssetAmount(FVal('1.352902561458047718')),
        rate=Price(FVal('0.001380394982972144001321983066')),
        trade_index=0,
        swaps=[
            AMMSwap(
                tx_hash='0x5e235216cb03e4eb234014f5ccf3efbfddd40c4576424e2a8204f1d12b96ed35',  # noqa: E501
                log_index=143,
                address=string_to_ethereum_address('0x029f388aC4D5C8BfF490550ce0853221030E822b'),  # noqa: E501
                from_address=string_to_ethereum_address('0x0000000000007F150Bd6f54c40A34d7C3d5e9f56'),  # noqa: E501
                to_address=string_to_ethereum_address('0x8982E9bBf7AC6A49c434aD81D2fF8e16895318e5'),  # noqa: E501
                timestamp=Timestamp(1607008218),
                location=Location.BALANCER,
                token0=EthereumToken('SYN'),
                token1=EthereumToken('WETH'),
                amount0_in=AssetAmount(FVal('980.08365587152306176')),
                amount1_in=AssetAmount(ZERO),
                amount0_out=AssetAmount(ZERO),
                amount1_out=AssetAmount(FVal('1.352902561458047718')),
            ),
        ],
    ),
    AMMTrade(
        trade_type=TradeType.BUY,
        base_asset=EthereumToken('WETH'),
        quote_asset=UnknownEthereumToken(
            ethereum_address=string_to_ethereum_address('0xa0afAA285Ce85974c3C881256cB7F225e3A1178a'),  # noqa: E501
            symbol='wCRES',
            name='Wrapped CRES',
            decimals=18,
        ),
        amount=AssetAmount(FVal('0.205709519074945018')),
        rate=Price(FVal('0.004296621671385733368065627638')),
        trade_index=0,
        swaps=[
            AMMSwap(
                tx_hash='0xf54be824b4619777f1db0e3da91b0cd52f6dba730c95a75644e2b085e6ab9824',  # noqa: E501
                log_index=300,
                address=string_to_ethereum_address('0x029f388aC4D5C8BfF490550ce0853221030E822b'),  # noqa: E501
                from_address=string_to_ethereum_address('0x0000000000007F150Bd6f54c40A34d7C3d5e9f56'),  # noqa: E501
                to_address=string_to_ethereum_address('0x10996eC4f3E7A1b314EbD966Fa8b1ad0fE0f8307'),  # noqa: E501
                timestamp=Timestamp(1607009877),
                location=Location.BALANCER,
                token0=UnknownEthereumToken(
                    ethereum_address=string_to_ethereum_address('0xa0afAA285Ce85974c3C881256cB7F225e3A1178a'),  # noqa: E501
                    symbol='wCRES',
                    name='Wrapped CRES',
                    decimals=18,
                ),
                token1=EthereumToken('WETH'),
                amount0_in=AssetAmount(FVal('47.87703800986513408')),
                amount1_in=AssetAmount(ZERO),
                amount0_out=AssetAmount(ZERO),
                amount1_out=AssetAmount(FVal('0.205709519074945018')),
            ),
        ],
    ),
    AMMTrade(
        trade_type=TradeType.BUY,
        base_asset=EthereumToken('API3'),
        quote_asset=EthereumToken('WETH'),
        amount=AssetAmount(FVal('295.881648100500428692')),
        rate=Price(FVal('298.7939728237741971462915003')),
        trade_index=0,
        swaps=[
            AMMSwap(
                tx_hash='0xfed4e15051e3ce4dc0d2816f719701e5920e40bf41614b5feaa3c5a6a0186c03',  # noqa: E501
                log_index=22,
                address=string_to_ethereum_address('0x029f388aC4D5C8BfF490550ce0853221030E822b'),  # noqa: E501
                from_address=string_to_ethereum_address('0x0000000000007F150Bd6f54c40A34d7C3d5e9f56'),  # noqa: E501
                to_address=string_to_ethereum_address('0x997c0fc9578a8194EFDdE2E0cD7aa6A69cFCD7c1'),  # noqa: E501
                timestamp=Timestamp(1607010888),
                location=Location.BALANCER,
                token0=EthereumToken('WETH'),
                token1=EthereumToken('API3'),
                amount0_in=AssetAmount(FVal('0.990253067370299904')),
                amount1_in=AssetAmount(ZERO),
                amount0_out=AssetAmount(ZERO),
                amount1_out=AssetAmount(FVal('295.881648100500428692')),
            ),
        ],
    ),
    AMMTrade(
        trade_type=TradeType.BUY,
        base_asset=EthereumToken('WETH'),
        quote_asset=EthereumToken('MFT'),
        amount=AssetAmount(FVal('0.686544199299304057')),
        rate=Price(FVal('0.000004102142824540561502137803041')),
        trade_index=0,
        swaps=[
            AMMSwap(
                tx_hash='0xf0147c4b81098676c08ae20ae5bf8f8b60d0ad79eec484f3f93ac6ab49a3c51c',  # noqa: E501
                log_index=97,
                address=string_to_ethereum_address('0x029f388aC4D5C8BfF490550ce0853221030E822b'),  # noqa: E501
                from_address=string_to_ethereum_address('0x0000000000007F150Bd6f54c40A34d7C3d5e9f56'),  # noqa: E501
                to_address=string_to_ethereum_address('0x2Eb6CfbFFC8785Cd0D9f2d233d0a617bF4269eeF'),  # noqa: E501
                timestamp=Timestamp(1607015059),
                location=Location.BALANCER,
                token0=EthereumToken('MFT'),
                token1=EthereumToken('WETH'),
                amount0_in=AssetAmount(FVal('167362.334434612660404224')),
                amount1_in=AssetAmount(ZERO),
                amount0_out=AssetAmount(ZERO),
                amount1_out=AssetAmount(FVal('0.686544199299304057')),
            ),
        ],
    ),
    AMMTrade(
        trade_type=TradeType.BUY,
        base_asset=EthereumToken('WETH'),
        quote_asset=EthereumToken('AAVE'),
        amount=AssetAmount(FVal('3.055412574642681758')),
        rate=Price(FVal('0.1445898203393074319511006560')),
        trade_index=1,
        swaps=[
            AMMSwap(
                tx_hash='0x67c0e9a0fdd002d0b9d1cca0c8e4ca4d30435bbf57bbf0091396275efaea414b',  # noqa: E501
                log_index=37,
                address=string_to_ethereum_address('0x029f388aC4D5C8BfF490550ce0853221030E822b'),  # noqa: E501
                from_address=string_to_ethereum_address('0x0000000000007F150Bd6f54c40A34d7C3d5e9f56'),  # noqa: E501
                to_address=string_to_ethereum_address('0x0E552307659E70bF61f918f96AA880Cdec40d7E2'),  # noqa: E501
                timestamp=Timestamp(1607015339),
                location=Location.BALANCER,
                token0=EthereumToken('AAVE'),
                token1=EthereumToken('WETH'),
                amount0_in=AssetAmount(FVal('21.131588430448123904')),
                amount1_in=AssetAmount(ZERO),
                amount0_out=AssetAmount(ZERO),
                amount1_out=AssetAmount(FVal('3.055412574642681758')),
            ),
        ],
    ),
    AMMTrade(
        trade_type=TradeType.BUY,
        base_asset=EthereumToken('AAVE'),
        quote_asset=EthereumToken('WETH'),
        amount=AssetAmount(FVal('21.131588567541018817')),
        rate=Price(FVal('6.967603293995613380604376603')),
        trade_index=0,
        swaps=[
            AMMSwap(
                tx_hash='0x67c0e9a0fdd002d0b9d1cca0c8e4ca4d30435bbf57bbf0091396275efaea414b',  # noqa: E501
                log_index=31,
                address=string_to_ethereum_address('0x029f388aC4D5C8BfF490550ce0853221030E822b'),  # noqa: E501
                from_address=string_to_ethereum_address('0x0000000000007F150Bd6f54c40A34d7C3d5e9f56'),  # noqa: E501
                to_address=string_to_ethereum_address('0x7c90a3cd7Ec80dd2F633ed562480AbbEEd3bE546'),  # noqa: E501
                timestamp=Timestamp(1607015339),
                location=Location.BALANCER,
                token0=EthereumToken('WETH'),
                token1=EthereumToken('AAVE'),
                amount0_in=AssetAmount(FVal('3.0328346313504')),
                amount1_in=AssetAmount(ZERO),
                amount0_out=AssetAmount(ZERO),
                amount1_out=AssetAmount(FVal('21.131588567541018817')),
            ),
        ],
    ),
]


@pytest.mark.parametrize('ethereum_accounts', [[BALANCER_TEST_ADDR2]])
@pytest.mark.parametrize('ethereum_modules', [['balancer']])
@pytest.mark.parametrize('start_with_valid_premium', [True])
def test_get_trades_history(
        rotkehlchen_api_server,
        ethereum_accounts,  # pylint: disable=unused-argument
        rotki_premium_credentials,  # pylint: disable=unused-argument
        start_with_valid_premium,  # pylint: disable=unused-argument
):
    """Test get the trades history for premium users works as expected.

    This test will fetch the first 75 swaps, from 1606921757 to 1607015339.
    Then it will check the resulting trades from 1607008178 (swap 68) to
    1607015339 (swap 75). This particular time range has swaps with the timestamp.

    Swaps 68 to 75 (the endpoint returns them in desc order):
        1607008178 - Trade 1
        1607008178 - Trade 2
        1607008218 - Trade 3
        1607009877 - Trade 4
        1607010888 - Trade 5
        1607015059 - Trade 6
        1607015339 - Trade 7
        1607015339 - Trade 7
    """
    async_query = random.choice([False, True])
    rotki = rotkehlchen_api_server.rest_api.rotkehlchen
    setup = setup_balances(
        rotki,
        ethereum_accounts=ethereum_accounts,
        btc_accounts=None,
        original_queries=['zerion', 'logs', 'blocknobytime'],
    )
    with ExitStack() as stack:
        # patch ethereum/etherscan to not autodetect tokens
        setup.enter_ethereum_patches(stack)
        response = requests.get(
            api_url_for(rotkehlchen_api_server, 'balancertradeshistoryresource'),
            json={
                'async_query': async_query,
                'from_timestamp': 0,
                'to_timestamp': 1607015339,
            },
        )
        if async_query:
            task_id = assert_ok_async_response(response)
            outcome = wait_for_async_task(rotkehlchen_api_server, task_id)
            assert outcome['message'] == ''
            result = outcome['result']
        else:
            result = assert_proper_response_with_result(response)

    db_trades = rotki.data.db.get_amm_swaps()
    assert len(db_trades) == 75

    address_trades = result[BALANCER_TEST_ADDR2]
    assert len(address_trades) == 75

    expected_trades = BALANCER_TEST_ADDR2_EXPECTED_TRADES[::-1]
    filtered_trades = address_trades[:len(expected_trades)]
    for trade, expected_trade in zip(filtered_trades, expected_trades):
        assert trade == expected_trade.serialize()


BALANCER_TEST_ADDR3_EXPECTED_HISTORY_POOL1 = (
    BalancerPoolEventsBalance(
        address=BALANCER_TEST_ADDR3,
        pool_address=BALANCER_TEST_ADDR3_POOL1,
        pool_tokens=[
            BalancerBPTEventPoolToken(
                token=EthereumToken('WETH'),
                weight=FVal('20'),
            ),
            BalancerBPTEventPoolToken(
                token=EthereumToken('BAL'),
                weight=FVal('80'),
            ),
        ],
        profit_loss_amounts=[
            AssetAmount(FVal('-0.039312851799093402')),
            AssetAmount(FVal('0.744372160905819159')),
        ],
        usd_profit_loss=FVal('-0.76584117161052920880190053'),
        events=[
            BalancerEvent(
                tx_hash='0xb9dff9df4e3838c75d354d62c4596d94e5eb8904e07cee07a3b7ffa611c05544',
                log_index=331,
                address=BALANCER_TEST_ADDR3,
                timestamp=Timestamp(1597144247),
                event_type=BalancerBPTEventType.MINT,
                pool_address=BALANCER_TEST_ADDR3_POOL1,
                lp_balance=Balance(
                    amount=FVal('0.042569019597126949'),
                    usd_value=FVal('19.779488662371895'),
                ),
                amounts=[
                    AssetAmount(FVal('0.05')),
                    AssetAmount(FVal('0')),
                ],
            ),
            BalancerEvent(
                tx_hash='0xfa1dfeb83480e51a15137a93cb0eba9ac92c1b6b0ee0bd8551a422c1ed83695b',
                log_index=92,
                address=BALANCER_TEST_ADDR3,
                timestamp=Timestamp(1597243001),
                event_type=BalancerBPTEventType.BURN,
                pool_address=BALANCER_TEST_ADDR3_POOL1,
                lp_balance=Balance(
                    amount=FVal('0.042569019597126949'),
                    usd_value=FVal('19.01364749076136579119809947'),
                ),
                amounts=[
                    AssetAmount(FVal('0.010687148200906598')),
                    AssetAmount(FVal('0.744372160905819159')),
                ],
            ),
        ],
    )
)
BALANCER_TEST_ADDR3_EXPECTED_HISTORY_POOL2 = (
    BalancerPoolEventsBalance(
        address=BALANCER_TEST_ADDR3,
        pool_address=BALANCER_TEST_ADDR3_POOL2,
        pool_tokens=[
            BalancerBPTEventPoolToken(
                token=EthereumToken('BAT'),
                weight=FVal('10'),
            ),
            BalancerBPTEventPoolToken(
                token=EthereumToken('LINK'),
                weight=FVal('35.0'),
            ),
            BalancerBPTEventPoolToken(
                token=EthereumToken('LEND'),
                weight=FVal('10'),
            ),
            BalancerBPTEventPoolToken(
                token=EthereumToken('MKR'),
                weight=FVal('10'),
            ),
            BalancerBPTEventPoolToken(
                token=EthereumToken('SNX'),
                weight=FVal('10'),
            ),
            BalancerBPTEventPoolToken(
                token=EthereumToken('WETH'),
                weight=FVal('15.0'),
            ),
            BalancerBPTEventPoolToken(
                token=EthereumToken('KNC'),
                weight=FVal('10'),
            ),
        ],
        profit_loss_amounts=[
            AssetAmount(FVal('0')),
            AssetAmount(FVal('0')),
            AssetAmount(FVal('0')),
            AssetAmount(FVal('0')),
            AssetAmount(FVal('0')),
            AssetAmount(FVal('-2.756044298156096352')),
            AssetAmount(FVal('0')),
        ],
        usd_profit_loss=FVal('-872.734395890491474835748575'),
        events=[
            BalancerEvent(
                tx_hash='0x256c042bf7d67a8b9e9566b8797335135015ab6e8d9196b1c39f5da7b8479006',
                log_index=171,
                address=BALANCER_TEST_ADDR3,
                timestamp=Timestamp(1598376244),
                event_type=BalancerBPTEventType.MINT,
                pool_address=BALANCER_TEST_ADDR3_POOL2,
                lp_balance=Balance(
                    amount=FVal('1289.21726317692448827'),
                    usd_value=FVal('3833.40'),
                ),
                amounts=[
                    AssetAmount(FVal('0')),
                    AssetAmount(FVal('0')),
                    AssetAmount(FVal('0')),
                    AssetAmount(FVal('0')),
                    AssetAmount(FVal('0')),
                    AssetAmount(FVal('10')),
                    AssetAmount(FVal('0')),
                ],
            ),
            BalancerEvent(
                tx_hash='0x6f9e6d5fd0562121ca4f695ffde661f5c184af421f68585be72ad59cfb8f881d',
                log_index=167,
                address=BALANCER_TEST_ADDR3,
                timestamp=Timestamp(1598377474),
                event_type=BalancerBPTEventType.BURN,
                pool_address=BALANCER_TEST_ADDR3_POOL2,
                lp_balance=Balance(
                    amount=FVal('1289.21726317692448827'),
                    usd_value=FVal('2960.665604109508525164251425'),
                ),
                amounts=[
                    AssetAmount(FVal('0')),
                    AssetAmount(FVal('0')),
                    AssetAmount(FVal('0')),
                    AssetAmount(FVal('0')),
                    AssetAmount(FVal('0')),
                    AssetAmount(FVal('7.243955701843903648')),
                    AssetAmount(FVal('0')),
                ],
            ),
        ],
    )
)
TEST_ADDR3_MOCKED_PRICES = {
    'BAL': {
        'USD': {
            1597243001: FVal('20.104674263041243'),
        },
    },
    'BAND': {
        'USD': {
            1597156065: FVal('14.466103356644934'),
            1597224640: FVal('12.534750403373085'),
        },
    },
    'COMP': {
        'USD': {
            1597156065: FVal('176.4065022915484'),
            1597224640: FVal('218.51'),

        },
    },
    'LEND': {
        'USD': {
            1597156065: FVal('0.39952667693410726'),
            1597224136: FVal('0.4026941951749709'),
        },
    },
    'LINK': {
        'USD': {
            1597156065: FVal('13.379675286664355'),
            1597224062: FVal('13.080656699562843'),
        },
    },
    'MKR': {
        'USD': {
            1597156065: FVal('624.6542090701207'),
            1597224640: FVal('591.9805247479154'),
        },
    },
    'WBTC': {
        'USD': {
            1597156065: FVal('11865.846868426604'),
            1597224062: FVal('11851'),
        },
    },
    'WETH': {
        'USD': {
            1597144247: FVal('395.5897732474379'),
            1597156065: FVal('395.5897732474379'),
            1597223901: FVal('387.19'),
            1597243001: FVal('378.7996188665494'),
            1598098652: FVal('395.46'),
            1598376244: FVal('383.34'),
            1598376468: FVal('408.7084082189914'),
            1598377474: FVal('408.7084082189914'),
        },
    },
    'ZRX': {
        'USD': {
            1597156065: FVal('0.4791234716020489'),
            1597224640: FVal('0.4416470964397209'),
        },
    },
}


@pytest.mark.parametrize('ethereum_accounts', [[BALANCER_TEST_ADDR3]])
@pytest.mark.parametrize('ethereum_modules', [['balancer']])
@pytest.mark.parametrize('start_with_valid_premium', [True])
@pytest.mark.parametrize('mocked_price_queries', [TEST_ADDR3_MOCKED_PRICES])
@pytest.mark.parametrize('should_mock_price_queries', [True])
def test_get_events_history_1(
        rotkehlchen_api_server,
        ethereum_accounts,  # pylint: disable=unused-argument
        rotki_premium_credentials,  # pylint: disable=unused-argument
        start_with_valid_premium,  # pylint: disable=unused-argument
):
    """Test POOL1 (WETH-BAL) events balance for ADDR3"""
    async_query = random.choice([False, True])
    rotki = rotkehlchen_api_server.rest_api.rotkehlchen
    setup = setup_balances(
        rotki,
        ethereum_accounts=ethereum_accounts,
        btc_accounts=None,
        original_queries=['zerion', 'logs', 'blocknobytime'],
    )
    with ExitStack() as stack:
        # patch ethereum/etherscan to not autodetect tokens
        setup.enter_ethereum_patches(stack)
        response = requests.get(
            api_url_for(rotkehlchen_api_server, 'balancereventshistoryresource'),
            json={
                'async_query': async_query,
                'from_timestamp': 1597144247,
                'to_timestamp': 1597243001,
            },
        )
        if async_query:
            task_id = assert_ok_async_response(response)
            outcome = wait_for_async_task(rotkehlchen_api_server, task_id)
            assert outcome['message'] == ''
            result = outcome['result']
        else:
            result = assert_proper_response_with_result(response)

    address_pool_events_balances = result[BALANCER_TEST_ADDR3]

    assert len(address_pool_events_balances) == 2
    pool_event_balances = [
        pool_events_balance
        for pool_events_balance in address_pool_events_balances
        if pool_events_balance['pool_address'] == BALANCER_TEST_ADDR3_POOL1
    ]

    assert len(pool_event_balances) == 1
    pool_events_balance = pool_event_balances[0]

    assert pool_events_balance == BALANCER_TEST_ADDR3_EXPECTED_HISTORY_POOL1.serialize()


@pytest.mark.parametrize('ethereum_accounts', [[BALANCER_TEST_ADDR3]])
@pytest.mark.parametrize('ethereum_modules', [['balancer']])
@pytest.mark.parametrize('start_with_valid_premium', [True])
@pytest.mark.parametrize('mocked_price_queries', [TEST_ADDR3_MOCKED_PRICES])
@pytest.mark.parametrize('should_mock_price_queries', [True])
def test_get_events_history_2(
        rotkehlchen_api_server,
        ethereum_accounts,  # pylint: disable=unused-argument
        rotki_premium_credentials,  # pylint: disable=unused-argument
        start_with_valid_premium,  # pylint: disable=unused-argument
):
    """Test POOL2 (BAT-LINK-LEND-MKR-SNX-WETH-KNC) events balance for ADDR3"""
    async_query = random.choice([False, True])
    rotki = rotkehlchen_api_server.rest_api.rotkehlchen
    setup = setup_balances(
        rotki,
        ethereum_accounts=ethereum_accounts,
        btc_accounts=None,
        original_queries=['zerion', 'logs', 'blocknobytime'],
    )
    with ExitStack() as stack:
        # patch ethereum/etherscan to not autodetect tokens
        setup.enter_ethereum_patches(stack)
        response = requests.get(
            api_url_for(rotkehlchen_api_server, 'balancereventshistoryresource'),
            json={
                'async_query': async_query,
                'from_timestamp': 1598376244,
                'to_timestamp': 1598377474,
            },
        )
        if async_query:
            task_id = assert_ok_async_response(response)
            outcome = wait_for_async_task(rotkehlchen_api_server, task_id)
            assert outcome['message'] == ''
            result = outcome['result']
        else:
            result = assert_proper_response_with_result(response)

    address_pool_events_balances = result[BALANCER_TEST_ADDR3]

    assert len(address_pool_events_balances) == 2
    pool_event_balances = [
        pool_events_balance
        for pool_events_balance in address_pool_events_balances
        if pool_events_balance['pool_address'] == BALANCER_TEST_ADDR3_POOL2
    ]

    assert len(pool_event_balances) == 1
    pool_events_balance = pool_event_balances[0]

    assert pool_events_balance == BALANCER_TEST_ADDR3_EXPECTED_HISTORY_POOL2.serialize()
