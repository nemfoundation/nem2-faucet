import {
    Address,
    Mosaic,
    UInt64,
    EmptyMessage,
    TransferTransaction,
    Transaction,
    Deadline,
    MosaicId,
    TransactionType,
    TransactionGroup,
} from 'symbol-sdk';
import { of, forkJoin } from 'rxjs';
import { map, mergeMap, filter, toArray, catchError } from 'rxjs/operators';
import { IApp } from '../app';
import helper from '../helper';

export const claimsHandler = (appConfig: IApp) => {
    return async (req: any, res: any, next: any) => {
        const { recipient, amount, selectedMosaics } = req.body;

        if (typeof recipient !== 'string' || recipient.length !== 39) throw new Error(`recipient address invalid.`);

        const { repositoryFactory, config } = appConfig;
        const faucetAccount = await appConfig.faucetAccount;
        const networkType = await appConfig.networkType;
        const generationHash = await appConfig.networkGenerationHash;
        const epochAdjustment = await appConfig.epochAdjustment;
        console.debug({ recipient, amount, selectedMosaics });

        if (typeof amount !== 'number') throw new Error(`amount format invalid.`);

        if (!Array.isArray(selectedMosaics)) throw new Error(`mosaics is not array.`);

        const mosaicIds = selectedMosaics.map((mosaic) => new MosaicId(mosaic));
        const recipientAddress: Address = Address.createFromRawAddress(recipient);
        const feeMultiplier = (await repositoryFactory.createNetworkRepository().getTransactionFees().toPromise()).highestFeeMultiplier;

        forkJoin([
            repositoryFactory.createNamespaceRepository().getMosaicsNames(mosaicIds),
            repositoryFactory.createMosaicRepository().getMosaics(mosaicIds),
            repositoryFactory.createAccountRepository().getAccountInfo(faucetAccount.address),
            repositoryFactory
                .createAccountRepository()
                .getAccountInfo(recipientAddress)
                .pipe(
                    catchError((error) => {
                        console.error({ error });
                        return of(null);
                    }),
                ),
            repositoryFactory
                .createTransactionRepository()
                .search({
                    group: TransactionGroup.Unconfirmed,
                    address: faucetAccount.address,
                })
                .pipe(
                    mergeMap((_) => _.data),
                    filter((tx) => tx.type === TransactionType.TRANSFER),
                    map((_) => _ as TransferTransaction),
                    filter((tx) => tx.recipientAddress.equals(recipientAddress)),
                    toArray(),
                    catchError((error) => {
                        console.error({ error });
                        return of([]);
                    }),
                ),
        ])
            .pipe(
                map((results) => {
                    const [
                        requestMosaicName,
                        requestMosaicInfo,
                        faucetAccountInfo,
                        recipientAccountInfo,
                        unconfirmedTransactions,
                    ] = results;

                    const requestMosaicsFromFaucetAccount = faucetAccountInfo.mosaics.filter((mosaic) =>
                        requestMosaicInfo.map((mosaicInfo) => mosaicInfo.id.toHex()).includes(mosaic.id.toHex()),
                    );

                    if (!requestMosaicInfo.length) throw new Error(`Requested mosaic is not available in network.`);

                    if (!requestMosaicsFromFaucetAccount.length) throw new Error(`Requested mosaic is not available in faucet account.`);

                    if (
                        config.BLACKLIST_MOSAICIDS.filter((mosaicHex) =>
                            requestMosaicInfo.map((mosaicInfo) => mosaicInfo.id.toHex()).includes(mosaicHex),
                        ).length
                    )
                        throw new Error(`Requested mosaic is blacklisted.`);

                    if (unconfirmedTransactions.length >= config.MAX_UNCONFIRMED)
                        throw new Error(
                            `Too many unconfirmed claiming.
                        Please wait ${unconfirmedTransactions.length} transactions confirmed.`,
                        );

                    for (let mosaic of requestMosaicsFromFaucetAccount) {
                        if (mosaic.id.toHex() !== config.NATIVE_CURRENCY_ID) {
                            if (mosaic.amount.compact() <= 0) throw new Error(`Faucet balance not enought to pay out.`);
                        } else {
                            // XYM Check
                            const nativeCurrencyMosaicInfo = requestMosaicInfo.find((mosaicInfo) => mosaicInfo.id.equals(mosaic.id));

                            if (!nativeCurrencyMosaicInfo) throw new Error(`Native currency mosaic not found.`);

                            const nativeCurrencyBalance = helper.toRelativeAmount(
                                mosaic.amount.compact(),
                                nativeCurrencyMosaicInfo.divisibility,
                            );

                            const maxOut = helper.toRelativeAmount(config.NATIVE_CURRENCY_OUT_MAX, nativeCurrencyMosaicInfo.divisibility);
                            const minOut = helper.toRelativeAmount(config.NATIVE_CURRENCY_OUT_MIN, nativeCurrencyMosaicInfo.divisibility);

                            // Check recipientBalanceMosaic
                            if (recipientAccountInfo) {
                                for (let recipientBalance of recipientAccountInfo.mosaics) {
                                    if (recipientBalance.id.equals(mosaic.id))
                                        if (recipientBalance.amount.compact() > config.MAX_BALANCE)
                                            throw new Error(`Your account already has enough balance of ${config.NATIVE_CURRENCY_NAME}`);
                                }
                            }

                            // Check Request Amount if More than maxOut
                            if (amount > maxOut)
                                throw new Error(`${config.NATIVE_CURRENCY_NAME} faucet available from ${minOut} to ${maxOut}`);

                            // Check Request Amount
                            if (amount > nativeCurrencyBalance) throw new Error(`Faucet balance not enought to pay out.`);
                        }
                    }

                    const requestedMosicList = requestMosaicsFromFaucetAccount.map((mosaic) => {
                        const mosaicDivisibility = requestMosaicInfo.find((mosaicInfo) => mosaicInfo.id.equals(mosaic.id));

                        if (!mosaicDivisibility) throw new Error(`Error occur during prepare Mosaic.`);

                        const randomAmount =
                            mosaic.id.toHex() === config.NATIVE_CURRENCY_ID
                                ? helper.toAbsoluteAmount(amount, mosaicDivisibility.divisibility) ||
                                  helper.getNativeCurrencyRandomAmount(
                                      mosaic.amount.compact(),
                                      config.NATIVE_CURRENCY_OUT_MIN,
                                      config.NATIVE_CURRENCY_OUT_MAX,
                                  )
                                : helper.getMosaicsRandomAmount(mosaic.amount.compact());

                        return new Mosaic(mosaic.id, UInt64.fromUint(randomAmount));
                    });

                    let transaction: Transaction;

                    if (config.MAX_FEE > 0) {
                        transaction = TransferTransaction.create(
                            Deadline.create(epochAdjustment),
                            recipientAddress,
                            requestedMosicList,
                            EmptyMessage,
                            networkType,
                            UInt64.fromUint(config.MAX_FEE),
                        );
                    } else {
                        transaction = TransferTransaction.create(
                            Deadline.create(epochAdjustment),
                            recipientAddress,
                            requestedMosicList,
                            EmptyMessage,
                            networkType,
                        ).setMaxFee(feeMultiplier);
                    }

                    const transferMosaics = requestedMosicList.map((mosaic) => {
                        const mosaicName: any = requestMosaicName.find((mosaicName) => mosaicName.mosaicId.equals(mosaic.id));
                        const mosaicInfo: any = requestMosaicInfo.find((mosaicInfo) => mosaicInfo.id.equals(mosaic.id));
                        const name = mosaicName.names.length ? mosaicName.names[0].name : mosaicName.mosaicId.id.toHex();

                        return {
                            amount: helper.toRelativeAmount(mosaic.amount.compact(), mosaicInfo.divisibility),
                            name: name,
                        };
                    });

                    const signedTx = faucetAccount.sign(transaction, generationHash);

                    repositoryFactory.createTransactionRepository().announce(signedTx);

                    return {
                        mosaics: transferMosaics,
                        txHash: signedTx.hash,
                    };
                }),
            )
            .subscribe(
                (result) => res.json(result),
                (error) => {
                    console.log(error.message);
                    res.status(422).json({ message: error.message });
                },
            );
    };
};

export default claimsHandler;
