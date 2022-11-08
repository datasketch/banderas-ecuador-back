const { EvaluationModule } = require("../../lib/lib");


class BidsExactPercentageApartEvaluationModule extends EvaluationModule {
    static moduleName = "bids-exact-percentage-apart";
    static params = [
        { name: "values", type: "query" }
    ];

    constructor() {
        super()
    }

    calculateResult(parameters,result) {
        let values = parameters.values;
        
        if(values && values.length > 1) {
            result.pass();
            let bidDifference = 0;
            let percentDifferenceA = 0;
            let percentDifferenceB = 0;
            let failingBids = []

            for (let i = 0; i < values.length; i++) {
                for (let k = i + 1; k < values.length; k++) {
                    if(values[i] != values[k]) {
                        bidDifference = Math.abs(values[i] - values[k]);
                        percentDifferenceA = bidDifference / values[i];
                        percentDifferenceB = bidDifference / values[k];
                        if(percentDifferenceA % 1 == 0) {
                            result.fail();
                            failingBids.push({ bids: [values[i], values[k]], percentage: percentDifferenceA })
                        }
                        else if(percentDifferenceB % 1 == 0) {
                            result.fail();
                            failingBids.push({ bids: [values[k], values[i]], percentage: percentDifferenceB })
                        }
                    }
                }
            }
            if(failingBids.length > 0) result.addResultDetails('exactPercentageDifference', failingBids);

        }
        return result;
    }
}


module.exports = {BidsExactPercentageApartEvaluationModule}
