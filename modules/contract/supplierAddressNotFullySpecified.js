const { EvaluationModule } = require("../../lib/lib");


class SupplierAddressNotFullySpecifiedEvaluationModule extends EvaluationModule {
    static moduleName = "supplier-address-not-fully-specified";
    static params = [
        { name: "value", type: "query" }
    ];

    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        result.pass();
        let address = parameters.value[0];

        if(address && (!address.hasOwnProperty('region') || !address.hasOwnProperty('locality') || !address.hasOwnProperty('countryName') || !address.hasOwnProperty('streetAddress'))) {
            result.fail()
        }
        else {
            if( address && this.addressNotValid(address.streetAddress) ) result.fail();
        }
        return result;
    }
    addressNotValid(streetAddress) {
        if(!streetAddress) return false;

        // https://prezi.com/gf1yjwtrklcn/estructura-de-direcciones-ecuador/
        if( streetAddress.split(' ').length < 4 ) return false; // At least 4 parts: main street, number, neighborhood, and reference
        if( !streetAddress.match(/\d/) || streetAddress.indexOf('S/N') < 0 ) return false; // Must have at least one number, or the string "S/N" (sin número)

        return true;
    }
}


module.exports = {SupplierAddressNotFullySpecifiedEvaluationModule}
