const { EvaluationModule, ConditionEvaluator } = require("../../lib/lib");


class PriceAwardedBidderBelowReferenceBudgetEvaluationModule extends EvaluationModule {
    static moduleName = "price-awarded-bidder-below-reference-budget";
    static params = [
        { name: "value", type: "query" },
        { name: "referenceValue", type: "query" },
        { name: "conditions", type: "conditionsArray" }
    ];

    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        let value = parameters.value[0];
        let referenceValue = parameters.referenceValue[0];
        let condition = new ConditionEvaluator(parameters.conditions[0]);

        if(value && referenceValue) {
            let percentDifference = Math.abs(value - referenceValue) / referenceValue * 100;
            if( condition.evaluate(percentDifference) ) result.fail();
            else result.pass();
            result.addResultDetails('percentDifference', percentDifference);
        }

        return result;
    }
}


module.exports = {PriceAwardedBidderBelowReferenceBudgetEvaluationModule}
