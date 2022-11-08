const { EvaluationModule } = require("../../lib/lib");


class LateBidderWinningBidderEvaluationModule extends EvaluationModule {
    static moduleName = "late-bidder-winning-bidder";
    static params = ["bids", "winningBid"];
    static params = [
        { name: "bids", type: "query" },
        { name: "winningBid", type: "query" }
    ];

    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        let bidDates = parameters.bids;
        let winningBidDate = parameters.winningBid[0];
        bidDates.sort();
        result.pass();

        if(bidDates[bidDates.length - 1] == winningBidDate) result.fail();

        return result;
    }
}


module.exports = {LateBidderWinningBidderEvaluationModule}
