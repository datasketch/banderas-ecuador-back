const { EvaluationModule } = require("../../lib/lib");


class WinningBidRoundNumbersEvaluationModule extends EvaluationModule {
    static moduleName = "winning-bid-round-numbers";
    static params = [
        { name: "value", type: "query" },
        { name: "amountOfZeros", type: "value" }
    ];


    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        result.pass();
        let winningBidAmount = parameters.value[0];
        if(winningBidAmount) winningBidAmount = winningBidAmount.toString();
        else return result;
        
        let amountOfZeros = parameters.amountOfZeros;
        let zerosString = '0'.repeat(amountOfZeros);

        if(winningBidAmount.length > amountOfZeros && winningBidAmount.substr(amountOfZeros * -1) == zerosString) {
            result.fail();
        }

        return result;
    }
}


module.exports = {WinningBidRoundNumbersEvaluationModule}
