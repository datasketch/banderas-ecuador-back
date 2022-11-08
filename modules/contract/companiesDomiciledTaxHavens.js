const { EvaluationModule } = require("../../lib/lib");


class CompaniesDomiciledTaxHavensEvaluationModule extends EvaluationModule {
    static moduleName = "companies-domiciled-tax-havens";
    static params = [
        { name: "values", type: "query" },
        { name: "comparisonValues", type: "value" }
    ];

    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        let values = parameters.values;
        let comparisonValues = parameters.comparisonValues;
        result.pass();

        values.map(v => {
            if( comparisonValues.indexOf(v) >= 0 ) result.fail();
        });
        return result;
    }
}


module.exports = {CompaniesDomiciledTaxHavensEvaluationModule}
