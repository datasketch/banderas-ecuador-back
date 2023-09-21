# Flagfetti 
OCDS contract red flag evaluator

Flagfetti has several modes or stages, described in "execution" section.

## Installation

- git clone
- npm install

## Configuration


The evaluation process can be configured differently for each dataset (country), each evaluation is carried out by a module, and the module can be configured.

The configuration file is a yaml file that is a required parameter for all commands.

The structure of the YAML file is as follows:
```
rulesetVersion: v3
kind: flagfettiRules
metadata:
  id: [ID]
spec: 
    [SPEC]
```

Here we need to customize the id, which will be appended to evaluations. The spec consists of the following structure:

```

  contractFields: Array of name:value, where value is a JsonQuery if it starts with a dot.
  categories: Array of objets with id, name and description for each of the categories.
  partyFields:
    partyIdentifier: Name for the elastic field that is the party id
    partyExtra: Array of elastic field names of extra information that needs to be added to the party evaluation object
  partySummaries: Array objects with name: type (cardinality, sum, value_count, terms-first-bucket). Field: is a elastic field name for the summary calculation. Terms-field-bucket has an include: array of values to be counted.
  contractRules: Array of rules.
  partyRules: Array of rules.
``` 

Each rule is an array element with the following structure:
```
name:
    category: Category id established in the spec.categories object.
    description: String of text describing this evaluation (not shown)
    module: Module id.
    parameters: Depends on the module.
    default: Default value (usually 1, can be 0 or any other number)
```

Contract Rules are applied in the contractEvaluation stage over the OCDS documents. The modules available are the following:
- bidders-who-bid-and-dont-win
- bids-exact-percentage-apart
- companies-domiciled-tax-havens
- date-difference
- duration-questioning-stage
- information-matches
- key-fields	
- large-difference-between-award-value-final-contract
- late-bidder-winning-bidder	
- presenceSuspiciousDates
- priceAwardedBidderBelowReferenceBudget
- supplierAddressNotFullySpecified
- supplierAddressSameProjectOfficials
- tenderSingleBidder
- unansweredBidderQuestions
- understandingTitle
- wideDisparityBidPrices
- winningBidRoundNumbers

And party rules are applied over the Contract Evaluation Results uploaded to Elastic. The modules available for party rules are:
- duplicatedId
- network
- oneFewBiddersWinDisproportionateNumberContractsSameType
- yearlyRepeatedValue

A full explanation of each module and it's parameters is still to be written.

## Execution

### Contract flags
This mode takes a stream of JSON OCDS documents from stdin and generates a stream of JSON EvaluationSummaries in stdout.

```node index.js -f ecuador.yml```

Example for local files

```pv ocds.json | node index.js -f ecuador.yml > contractFlags.jsonl```


Command line parameters:
```
--flags -f String Name of file containing flag definitions (should always be placed in root folder?)
```

### Party preprocess
This mode takes a stream of JSON EvaluationSummaries from stdin and generates files in the modules/datasets for each module that provides a preprocess() method.

Syntax:
```node partyPreprocess.js -f [config.yml]```

Command line parameters:
```
--flags -f String Name of file containing flag definitions (should always be placed in root folder?)
```

## Party evaluation
This mode requires JSON EvaluationSummaries to be loaded to an ElasticSearch database and the partyPreprocess mode to be run.

Syntax:
```node partyEvaluation.js -e https://user:pass@elastic:9200 -s [source_index] -f [config.yml]```

## Party summaries
This mode requires JSON EvaluationSummaries and PartyEvaluations to be loaded to an ElasticSearch database


Syntax:
```node partySummaries.js -e https://user:pass@elastic:9200 -s [contract_flag_index],[party_flag_index] -f [config.yml]```

Command line parameters:
```
--elastic-uri -e String elasticsearch instance uri
--source -s String Source index for the contract flags
--destination -d String Destination index for the party flags
--flags -f String Name of file containing flag definitions (should always be placed in root folder?)
--start-after -a String The name or letter to star after, for continuing interrupted processes or testing
--output-format -o String The output format. Default is JSON. Alternative is CSV.
--latency-offset -l The time to wait for all evaluation promises to return before sending party summaries in stdout in CSV output mode
```

## Convert contract flags to csv

Syntax:
```pv contractFlags.jsonl | node flagfetti-contractflags-tocsv.json > out.csv```

### Convert all contract flags from a folder in parallel

```
parallel -j5 --bar cat '{} | node flagfetti-contractflags-tocsv.js  > /output/path/{/.}.csv' ::: `ls /path/to/contract/flags/*`

```

## Partys ranking based on party flags

Syntax:
```node flagfetti-rankings-generator.js -e https://user:pass@elastic:9200 -s [party_flag_index] -d /path/to/files/filenamePrefix```

Command line parameters:
```
--elastic-uri -e String elasticsearch instance uri
--source -s String Source index for the contract flags
--destination -d String Destination index for the party flags
```

## Custom modules

A module is a javascript class in a file that lives in the modules/contract or modules/party folder.

The class extends either EvaluationModule or PartyEvaluationModule.

The structure of an empty contract module is like this:

```
const { EvaluationModule } = require("../../lib/lib");


class EmptyEvaluationModule extends EvaluationModule {
    static moduleName = "empty";
    static params = [
        //Add params for validation where
        //Ex: { name: "parties", type: "query" },
    ];

    constructor(rule) {
        super(rule)
    }

    calculateResult(parameters,result) {
        if (1=1) {
            result.pass();
        }
        else {
            result.fail();
        }
    }
}

module.exports = {BiddersWhoBidAndDontWinEvaluationModule}

```

Party modules have an extra method called getAgg(params) that returns a JSON to add to the Elastic Search Document in the aggregations section.

## Licensing

There's a partial version of flagfetti licensed under GPLv3 for the guatemala hackathon. The rest of the code's license is TBD.

https://github.com/FAD-Hackathons/ensamble