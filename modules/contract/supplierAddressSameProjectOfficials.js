const { EvaluationModule } = require("../../lib/lib");


class SupplierAddressSameProjectOfficialsEvaluationModule extends EvaluationModule {
    static moduleName = "supplier-address-same-project-officials";
    static params = [
        { name: "buyerAddress", type: "query" },
        { name: "supplierAddress", type: "query" }
    ];

    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        let buyerAddress = parameters.buyerAddress[0];
        let supplierAddress = parameters.supplierAddress[0];
        result.pass();

        if(buyerAddress && supplierAddress) {
            // No need to compare countryName
            // Compare region
            if(buyerAddress.hasOwnProperty('region') && supplierAddress.hasOwnProperty('region') && buyerAddress.region == supplierAddress.region) {
                // Compare locality
                if(buyerAddress.hasOwnProperty('locality') && supplierAddress.hasOwnProperty('locality') && buyerAddress.locality == supplierAddress.locality) {
                    // Compare street address
                    if(buyerAddress.hasOwnProperty('streetAddress') && supplierAddress.hasOwnProperty('streetAddress') && buyerAddress.streetAddress == supplierAddress.streetAddress) {
                        result.fail()
                    }
                }
            }
        }
        return result;
    }
}


module.exports = {SupplierAddressSameProjectOfficialsEvaluationModule}
