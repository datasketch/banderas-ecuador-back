const { EvaluationModule } = require("../../lib/lib");


class LateBidderWinningBidderEvaluationModule extends EvaluationModule {
    static moduleName = "late-bidder-winning-bidder";
    static params = ["bids", "winningBid"];
    static params = [
        { name: "bids", type: "query" },
        { name: "winningBid", type: "query" },
        { name: "date", type: "query" },
        { name: "procurementMethod", type: "query" }
    ];

    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        let bidDates = parameters.bids;
        let winningBidDate = parameters.winningBid[0];
        let date = parameters.date[0];
        let procurementMethod = parameters.procurementMethod[0];
        let year = 0;

        bidDates.sort();
        result.pass();
        if(date) year = parseInt( date.split('-')[0] );

        if(year > 2015 && procurementMethod && procurementMethod.match(/^Catálogo electrónico.*/)) { result.pass(); }
        else if(bidDates.length > 0 && bidDates[bidDates.length - 1] == winningBidDate) result.fail();

        return result;
    }
}


module.exports = {LateBidderWinningBidderEvaluationModule}
