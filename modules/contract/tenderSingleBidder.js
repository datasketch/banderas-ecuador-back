const { EvaluationModule, ConditionEvaluator } = require("../../lib/lib");


class TenderSingleBidderEvaluationModule extends EvaluationModule {
    static moduleName = "tender-single-bidder-only";
    static params = [
        { name: "value", type: "query" },
        { name: "conditions", type: "conditionsArray" }
    ];
    result = null;

    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        let numberOfTenderers = parameters.value[0];
        let condition = new ConditionEvaluator(parameters.conditions[0]);

        if(numberOfTenderers !== null && numberOfTenderers !== []) {
            if( condition.evaluate(numberOfTenderers) ) result.fail();
            else result.pass();
        }

        return result;
    }
}


module.exports = {TenderSingleBidderEvaluationModule}
