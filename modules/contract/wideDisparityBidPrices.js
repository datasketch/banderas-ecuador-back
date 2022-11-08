const { EvaluationModule, ConditionEvaluator } = require("../../lib/lib");


class WideDisparityBidPricesEvaluationModule extends EvaluationModule {
    static moduleName = "wide-disparity-bid-prices";
    static params = [
        { name: "values", type: "query" },
        { name: "conditions", type: "conditionsArray" }
    ];

    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        let values = parameters.values;
        let condition = new ConditionEvaluator(parameters.conditions[0]);

        if(values && values.length > 1) {
            values.sort();
            let minBid = values[0];
            let maxBid = values[values.length - 1];
            let minToMaxRatio = maxBid / minBid;

            if( condition.evaluate(minToMaxRatio) ) result.fail();
            else result.pass();
            result.addResultDetails('minToMaxRatio', minToMaxRatio);
        }

        return result;
    }
}


module.exports = {WideDisparityBidPricesEvaluationModule}
