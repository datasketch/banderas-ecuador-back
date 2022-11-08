const { EvaluationModule } = require("../../lib/lib");


class BiddersWhoBidAndDontWinEvaluationModule extends EvaluationModule {
    static moduleName = "bidders-who-bid-and-dont-win";
    static params = [
        { name: "parties", type: "query" },
        { name: "date", type: "query" }
    ];

    constructor(rule) {
        super(rule)
    }

    calculateResult(parameters,result) {
        let parties = parameters.parties;
        let date = parameters.date[0];
        result.pass();

        if(parties && date) {
            let year = date.split('-')[0];
            parties.map( p => {
                if( this.bidderInTop(p.name, year) ) result.fail();
            } );
        }
        return result;
    }

    bidderInTop(bidder, year) {
        if( this.additionalData.ecuadorTop100 && this.additionalData.ecuadorTop100.hasOwnProperty(year) && this.additionalData.ecuadorTop100[year].hasOwnProperty(bidder) )
            return true;
        return false;
    }
}


module.exports = {BiddersWhoBidAndDontWinEvaluationModule}
