<template>
    <b-container fluid="lg" style="max-width: 1200px">
        <b-row>
            <b-col cols="12" lg="6">
                <div class="p-3">
                    <b-col>
                        <b-row>
                            <b-img src="~/assets/images/symbol_logo_white.svg" fluid alt="Symbol" width="240" />
                        </b-row>
                        <b-row>
                            <div>
                                <span class="subTitle">Claim mosaics for development and testing purposes on the symbol network</span>
                            </div>
                        </b-row>

                        <b-row>
                            <FaucetForm
                                class="d-lg-none d-xl-none d-md-block mx-form"
                                :address="networkInfo.address"
                                :mosaic-id="networkInfo.nativeCurrencyId"
                                :mosaic-ticker="mosaicTicker"
                                :filter-mosaics="filterMosaics"
                                :recipient-placeholder="recipientPlaceholder"
                                :amount-placeholder="amountPlaceholder"
                            />
                        </b-row>

                        <b-row>
                            <div class="info">
                                <span>Please send back claimed mosaics when you no longer need them.</span>
                                <span v-if="mosaicTicker === 'XYM'"
                                    >If anyone wants to claim 3m {{ mosaicTicker }} to allow setting up a voting node/supernode, please
                                    request from the <a target="_blank" href="https://t.me/nemhelpdesk">@nemhelpdesk</a> telegram channel
                                </span>
                                <span>
                                    Faucet Address:
                                    <span class="highlight">
                                        <a target="_blank" :href="faucetAccountUrl">
                                            {{ networkInfo.address }}
                                        </a>
                                    </span>
                                </span>
                            </div>
                        </b-row>
                    </b-col>
                </div>
            </b-col>

            <b-col lg="6">
                <FaucetForm
                    class="d-lg-block d-none"
                    :address="networkInfo.address"
                    :mosaic-id="networkInfo.nativeCurrencyId"
                    :mosaic-ticker="mosaicTicker"
                    :filter-mosaics="filterMosaics"
                    :recipient-placeholder="recipientPlaceholder"
                    :amount-placeholder="amountPlaceholder"
                />
            </b-col>
        </b-row>
    </b-container>
</template>

<script>
import { Address } from 'symbol-sdk';
import FaucetForm from '@/components/FaucetForm.vue';

export default {
    components: {
        FaucetForm,
    },
    computed: {
        filterMosaics() {
            return this.$store.getters.getFilterMosaics;
        },
        networkInfo() {
            return this.$store.getters.getNetworkInfo;
        },
        recipientPlaceholder() {
            return `Address starts with a capital ${this.networkInfo.address[0]}`;
        },
        amountPlaceholder() {
            return `(Faucet will pay up to ${this.networkInfo.nativeCurrencyMaxOut} ${this.mosaicTicker}, or enter custom amount)`;
        },
        faucetAccountUrl() {
            return `${this.networkInfo.explorerUrl}accounts/${Address.createFromRawAddress(this.networkInfo.address).plain()}`;
        },

        mosaicTicker() {
            return this.networkInfo.nativeCurrencyName?.split('.').pop().toUpperCase() || 'XYM';
        },
    },
    created() {
        if (process.browser) {
            // inject method into $nuxt, allow access from store
            this.$nuxt.$makeToast = this.makeToast;
        }
    },
    methods: {
        makeToast(variant = null, message, config) {
            this.$bvToast.toast(message, {
                title: `Notification`,
                variant,
                solid: true,
                toaster: 'b-toaster-top-right',
                appendToast: true,
                ...config,
            });
        },
    },
};
</script>
<style lang="scss" scoped>
.container {
    margin-top: 20px;
}

.row {
    padding: 10px 0;
}

.subTitle {
    font-size: 18px;
    font-weight: bolder;
}

.mx-form {
    margin: 0 -0.7rem !important;
    padding: 0 0.7rem !important;
}

.info {
    span {
        display: block;
        padding: 5px 0;
        font-size: 14px;

        .highlight {
            display: inline;
            color: var(--secondary);
        }
    }
}
</style>
