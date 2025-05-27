import { BigNumber, utils } from 'ethers'
import { task, types } from 'hardhat/config'
import { ActionType, HardhatRuntimeEnvironment } from 'hardhat/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'

const makeBytes32 = (bytes?: string): string => utils.hexZeroPad(bytes || '0x0', 32)

const getLayerZeroScanLink = (hash: string, isTestnet = false) =>
    isTestnet ? `https://testnet.layerzeroscan.com/tx/${hash}` : `https://layerzeroscan.com/tx/${hash}`

interface TaskArguments {
    dstEid: number
    amount: string
    to: string
    contractName: string
}

const action: ActionType<TaskArguments> = async (
    { dstEid, amount, to, contractName },
    hre: HardhatRuntimeEnvironment
) => {
    const signer = await hre.ethers.getNamedSigner('deployer')
    // @ts-expect-error ignore for example
    const token = (await hre.ethers.getContract(contractName)).connect(signer)

    const amountLD = BigNumber.from(amount)
    const sendParam = {
        dstEid,
        to: makeBytes32(to),
        amountLD: amountLD.toString(),
        minAmountLD: amountLD.mul(9_000).div(10_000).toString(),
        extraOptions: '0x',
        composeMsg: '0x',
        oftCmd: '0x',
    }
    const [msgFee] = await token.functions.quoteSend(sendParam, false)
    const txResponse = await token.functions.send(sendParam, msgFee, signer.address, {
        value: msgFee.nativeFee,
        gasLimit: 500_000,
    })
    const txReceipt = await txResponse.wait()
    console.log(`send: ${amount} to ${to}: ${txReceipt.transactionHash}`)
    console.log(
        `Track cross-chain transfer here: ${getLayerZeroScanLink(
            txReceipt.transactionHash,
            dstEid == EndpointId.SOLANA_V2_TESTNET
        )}`
    )
}

task('send', 'Sends a transaction', action)
    .addParam('dstEid', 'Destination endpoint ID', undefined, types.int, false)
    .addParam('amount', 'Amount to send in wei', undefined, types.string, false)
    .addParam('to', 'Recipient address', undefined, types.string, false)
    .addOptionalParam('contractName', 'Name of the contract in deployments folder', 'MyOFT', types.string)
