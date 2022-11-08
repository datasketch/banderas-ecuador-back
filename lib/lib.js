const yaml = require('js-yaml');
const fs = require('fs');
const { Client } = require("@elastic/elasticsearch");
const JsonQuery = require('json-query');
/*
- DSLParser
    - verificar consistencia
    - generar la estructura base de las evaluaciones, template para doc de evaluación
    - generar función de copia con los campos a copiar del contrato
    - tokenizar las reglas y armar el pipeline de evaluación
    - devuelve una funcion de copia y un pipeline de evaluación
*/
class DSLParser {
    contractFields = [];
    DSLPath = [];
    modulePath = "";

    static moduleMap = {};
    static preprocess = false;

    constructor(DSLPath, modulePath) {
        this.DSLPath = DSLPath;
        this.modulePath = modulePath || "../modules";
    }

    init(options) {
        if (options && options.preprocess == true) {
            DSLParser.preprocess = true;
        }

        this.load(this.DSLPath);
        this.loadAllModules();
        this.validateRules();

        return this;
    }

    load(path) {
        const doc = yaml.load(fs.readFileSync(path, 'utf8'));
        try {
            this.parse(doc)
        } catch (e) {
            // throw(new Error("Error parsing YAML",e))
            console.error(e);
            process.exit(1);
        }
    }
    parse(doc) {
        if(doc.hasOwnProperty('kind') && doc.hasOwnProperty('spec')) {
            switch(doc.kind) {
                case 'flagfettiRules':
                    this.getFieldsFromDSL(doc.spec);
                    this.getRulesFromDSL(doc.spec);
                    break;
                default:
                    console.error('Invalid kind of YAML.');
            }
        }
        else {
            throw(new Error("Malformed YAML DSL. Kind and spec are required."))
        }
    }

    getFieldsFromDSL(spec) {
        if(spec.contractFields) {
            spec.contractFields.map( field => {
                this.contractFields.push(field);
            } );
        }
    }

    getRulesFromDSL(spec) {
        this.partyRules = Object.values(spec.partyRules);
        this.contractRules = Object.values(spec.contractRules);
        this.partySummaries = Object.values(spec.partySummaries);
        this.partyFields = spec.partyFields;
        this.rules = [... this.partyRules, ...this.contractRules]
    }

    loadAllModules() {
        let allModules = [];
        //https://javascript.tutorialink.com/import-and-execute-all-files-on-folder-with-es6/
        loadModulesFromFolder("../modules/contract/");
        loadModulesFromFolder("../modules/party/");
        function loadModulesFromFolder(folder) {
            let moduleBasePath = __dirname+"/"+folder;
            fs.readdirSync(moduleBasePath).map((moduleFile) => {
                if (moduleFile === "index.js") return;
                let moduleName = moduleFile.split(".js")[0];
                let modPath = moduleBasePath + "/" + moduleName;
                let mod = require(modPath);
                allModules.push(mod);
                // console.log(modPath,Object.values(mod));
            });
        }
        // console.log("allModules",allModules);


        //Make a map of all module classes
        allModules.map(modules => {
            Object.values(modules).map(o => {
                DSLParser.moduleMap[o.moduleName] = o;
            });
        });
        // console.log("moduleMap",DSLParser.moduleMap);

    }

    validateRules() {
        // use DSLParser.moduleMap to get static parameters list and validate against YAML
        try {
            this.rules.map( rule => {
                let moduleDef = DSLParser.moduleMap[ rule[Object.keys(rule)[0]].module ];
                let ruleDef = rule[Object.keys(rule)[0]];
                // console.log(rule, moduleDef);

                if (!moduleDef) {
                    throw(new Error("validateRules: Module not found for rule. "+JSON.stringify(rule)))
                }

                if(moduleDef.hasOwnProperty('params')) {
                    let moduleParams = moduleDef.params;
                    moduleParams.map(param => {
                        if(!ruleDef.parameters.hasOwnProperty(param.name)) throw(new Error("Malformed YAML DSL. Missing parameter \"" + param.name + "\" in module " + ruleDef.module));
                        // TODO: validar que el tipo del parametro definido en el módulo corresponda a lo que viene del YAML
                    })
                }
            } );
        } catch (e) {
            console.error(e);
            process.exit(2);
        }
    }
}


/*
- PipelineIterator
    - recibe el documento del streamreader
    - aplica la cadena de funciones que genera el DSLParser
    - devuelve el resultado de la evaluación al stream writer
*/
class PipelineIterator {
    flags = {};
    pipeline = [];

    constructor(flags,ruleType="contractRules") {
        this.flags = flags;

        // console.log(this.flags);
        // console.log(ruleType);

        //Instantiate PartyEvaluationModules for each rule
        this.flags[ruleType].map(ruleObject => {
            let ruleName = Object.keys(ruleObject)[0];
            let rule = ruleObject[ruleName];
            rule.name = ruleName;
            // console.log(rule)
            let evaluationModule = {
                rule: rule,
                module: this.getModuleForRule(rule)
            }
            this.pipeline.push(evaluationModule);
        });
    }

    getModuleForRule(rule) {
        // console.log(rule.module,DSLParser.moduleMap["tender-single-bidder-only"])
        if (DSLParser.moduleMap.hasOwnProperty(rule.module)) {
            return new DSLParser.moduleMap[rule.module](rule);
        }
        else {
            throw(new Error("PartyEvaluationModule getModuleForRule: Module not found for rule. "+JSON.stringify(rule)))
        }
    }

    getContractFields(contractFields,document) {
        let values = {};
        // console.log(document);
        contractFields.map( field => {
            let fieldValue = null;
            let fieldName;

            try {
                fieldName = Object.keys(field)[0];
                if(typeof field[fieldName] === "string") {
                    fieldValue = ValueFilter.parse(field[fieldName], document);
                    // console.log(field[fieldName],document.releases[0].ocid,fieldValue);
                }
                // If multiple field values, select first field with a value (iterate backwards and keep last non-null value)
                else if(field[fieldName]) {
                    for(let i=field[fieldName].length-1; i>=0; i--) {
                        let indexValue = ValueFilter.parse(field[fieldName][i], document);
                        // console.log(fieldName,indexValue,fieldValue)
                        fieldValue = indexValue ? indexValue[0] : fieldValue;
                    }
                }
            }
            catch(e) {
                //TODO: Handle missing fields
                console.error("Error: copyFieldValues:",field,e);
                process.exit(2);

            }

            //Don't return one-string arrays
            if (fieldValue && fieldValue.length == 1 && (typeof fieldValue[0] === "string" || typeof fieldValue[0] === "number")) {
                fieldValue = fieldValue[0]
            }
            values[fieldName] = fieldValue;
        } )

        return values;
    }

    evaluate(doc) {
        return this.pipeline.map(step => {
            let parameters = this.processParameters(step, doc);
            return step.module.evaluate(parameters, step.rule);
        })
    }

    processParameters(step, doc) {
        let parameters = {}
        let moduleParams = step.module.constructor.params;

        moduleParams.map( param => {
            switch(param.type) {
                case 'query':
                    parameters[param.name] = ValueFilter.parse(step.rule.parameters[param.name], doc);
                    break;
                case 'queryArray':
                    parameters[param.name] = step.rule.parameters[param.name].map( p => {
                        return ValueFilter.parse(p, doc);
                    } );
                    // console.log('processParameters', parameters[param.name]);
                    break;
                case 'value':
                case 'conditionsArray':
                    parameters[param.name] = step.rule.parameters[param.name];
                    break;
            }
        } );

        return parameters;
    }

    out() {}

}


/*
- ValueFilter
    - Recibe: Listado de campos con su pre-proceso y condiciones
    - se encarga de obtener los campos requeridos para el evaluador
    - puede filtrar el valor de un campo con base en las condiciones predefinidas en el DSL
    - puede pre-procesar los valores antes de devolverlo
    - ejemplo: obtener la dirección del party con role de "supplier"
*/
class ValueFilter {
    // #fields = [];

    static helpers = {
        concat: function (item,value,value2) {
            // console.log(item,key,value,value2);
            // process.exit();
            return item[value]+"-"+item[value2];
        },
        filter: function (item,key,value) {
            return item[key].indexOf(value) > -1;
        },
        filterMulti: function (item,key,value,value2) {
            return (item[key].indexOf(value) > -1 || item[key].indexOf(value2) > -1);
        },
        filterNegative: function (item,key,positive,negative) {
            return item[key].indexOf(positive) > -1 && item[key].indexOf(negative) == -1;
        },

    }

    static parse(query, document) {
        return JsonQuery(query, {data: document, locals: ValueFilter.helpers, allowRegexp: true }).value;
    }

    // process(document) {
    //     let filteredDocument = {};
    //     this.#fields.map((field,value) => {
    //         //TODO: Filter values
    //         filteredDocument[field] = document[field];
    //     })
    //     return filteredDocument;
    // }
}


//Party evaluation

class PartyPipelineIterator extends PipelineIterator {
    source = "";
    processedAggregations = []
    aggregatedSource = {}
    client = null;
    flags = {}

    baseAggs = {
        "parties": {
            "composite": {
              "after": { "party": "" },
              "size": 200,
              "sources": [
                {
                  "party": {
                    "terms": {
                    //   "field": "description.parties.name.keyword"
                    }
                  }
                }
              ]
            },
            "aggs": {
                "partyExtra": {
                    "top_hits": {
                      "size": 1,
                      "_source": [
                        // "description.parties.name",
                        // "description.parties.address.locality",
                        // "description.parties.address.region",
                        // "description.parties.roles",
                        // "description.parties.id"
                        ]
                    }
                }
            }
        }

    }

    constructor(source,flags) {
        super(flags,"partyRules");
        this.flags = flags;
        this.source = source;
        // console.log(this.flags.partyFields);
        this.baseAggs.parties.composite.sources[0].party.terms = { field: this.flags.partyFields.partyIdentifier }
        this.baseAggs.parties.aggs.partyExtra.top_hits._source = this.flags.partyFields.partyExtra;
    }

    preprocess(doc) {
        return this.pipeline.map(step => {
            return step.module.preprocess(doc, step.rule);
        })
    }

    csvPartyHeaders() {
        let headers = "";
        this.flags.partyFields.partyExtra.map(field => {
            headers += "'"+field+"',";
        })
        return headers+"'result.rule','result.category','result.result','year.year','year.value'";
    }

    csvSummariesHeaders() {
        let headers = "";
        this.flags.partyFields.partyExtra.map(field => {
            headers += "'"+field+"',";
        })
        return headers+"'category','categoryValue','year'";
    }
        //This function needs to find in a batch of parties the one that we're looking for and then find in it's regionAndLocality aggregation the party that we're looking for and return it's address
    getPartyExtra(doc) {
        let partyExtra  = {}

        doc.agg.aggregations.parties.buckets.map(b => {
            if (b.key.party == doc.party) {
                // console.log("getPartyExtra",JSON.stringify(b.partyExtra.hits.hits[0]._source,null,4));
                // process.exit();
                this.flags.partyFields.partyExtra.map(extraQuery => {
                    let fixedParty = doc.party;

                    //TODO: Improve performance or refactor
                    ["&","\\","(",")","?","+"].map(c => {
                        const regex = new RegExp(`\\${c}`,"g");
                        fixedParty = fixedParty.replace(regex,".")
                    })
                    let filteredExtraQuery=extraQuery.replace("parties","parties[name~/"+fixedParty+"/]");
                    // console.log(filteredExtraQuery,ValueFilter.parse(filteredExtraQuery,b.partyExtra.hits.hits[0]._source));
                    partyExtra[extraQuery] = ValueFilter.parse(filteredExtraQuery,b.partyExtra.hits.hits[0]._source);
                })
            }
        })

        return partyExtra;
    }
    //This function needs to find in a batch of parties the one that we're looking for and then find in it's regionAndLocality aggregation the party that we're looking for and return it's address
    getPartyContractResults(doc) {
        let contractResults  = {}


        doc.agg.aggregations.parties.buckets.map(p => {
            if (p.key.party == doc.party) {
                // console.log(p.key.party,p.partyExtra.hits.hits[0]._source.description.parties);
                // process.exit(1);
                this.flags.contractRules.forEach(rule => {
                    let ruleName = Object.keys(rule)[0];

                    p.contractRules_contracts_per_year.buckets.map(year => {
                        year["contractRules-"+ruleName].buckets.map(b => {

                            if (!contractResults[ruleName]) {
                                contractResults[ruleName] = new EvaluationResult({
                                    name: "contract-"+b.key,
                                    category: rule[ruleName].category,
                                    default: rule[ruleName].default,
                                });
                            }

                            contractResults[ruleName].years.push({year: year.key_as_string, value: b.result.value})
                        })

                    })
                })
                // this.flags.contractRules.forEach(rule => {
                //     // console.log(Object.keys(rule)[0]);
                //     let ruleName = Object.keys(rule)[0];

                //     b["contractRules-"+ruleName].buckets.map(b => {
                //         let r = new EvaluationResult({
                //             name: "contract-"+b.key,
                //             category: rule[ruleName].category,
                //             default: rule[ruleName].default
                //         });
                //         r.result = b.result.value;
                //         contractResults.push(r);
                //     })
                // })
            }
        })
        return Object.values(contractResults).map(r => {
            r.result = r.years.map(y => y.value).reduce((a,b)=>a+b) / r.years.length;
            return r;
        })

        // return contractResults;
    }

    preprocessWrite() {
        return this.pipeline.map(step => {
            // console.log(step);
            let preprocessed = step.module.getPreprocessed(step.rule);
            // console.log(step);
            if (Object.keys(preprocessed).length > 0) {
                fs.writeFileSync(
                    "modules/datasets/preprocess-"+step.rule.name+".json",
                    JSON.stringify(preprocessed)
                )
            }
        })

    }


    static getClient(elasticNode) {
        if (this.client == null) {
            try {
                this.client = new Client({ node: elasticNode, requestTimeout: 1000000, sniffOnStart: true, tls: { rejectUnauthorized: false }, resurrectStrategy: "none", compression: "gzip" })
            }
            catch (e) {
                console.error("getClient",e);
            }
        }

        return this.client;

    }


    //Add corresponding aggregations to each modules parameters
    processParameters(step, doc = {}) {
        // console.log("processParameters agg",JSON.stringify(doc));
        let params =  super.processParameters(step, {});
        params.party = doc.party;
        params.source = this.source;
        if (doc.agg) {
            params.agg = {};

            //Get the aggregations requested by the module
            let moduleAggs = Object.keys(step.module.getAgg(params))
            // console.log("moduleAggs",moduleAggs);

            //parties is the hardcoded base aggregation
            doc.agg.aggregations.parties.buckets.map(b => {
                //Only send aggregations for the same party
                if (b.key.party == doc.party) {
                    // console.log("b",b);

                    //Iterate trough all aggregations of this party
                    Object.keys(b).map(bagg => {
                        // console.log("bagg",bagg,moduleAggs);
                        //If this aggregation was requested by this module, add it to its parameters
                        if (moduleAggs.indexOf(bagg) > -1) {
                            params.agg[bagg] = b[bagg];
                            // params.role = ;
                            // console.log("aggregando",step,bagg,params);

                        }
                    })
                }
            } );
        }
        return params;
    }

    generateContractAggs() {
        let agg = {
            "contractRules_contracts_per_year": {
                "date_histogram": {
                    "field": "description.date",
                    "calendar_interval": "year",
                    "format": "yyyy" ,
                    "min_doc_count": 1
                },

                "aggs": {

                }
            },
        }
        let contractAggs = {};
        this.flags.contractRules.forEach(rule => {
            // console.log(Object.keys(rule)[0]);
            let ruleName = Object.keys(rule)[0];
            contractAggs["contractRules-"+ruleName] = {
                "terms": {
                    "field": "results."+ruleName+".rule.keyword"
                },
                "aggs": {
                    "result": {
                        "avg": {
                            "field": "results."+ruleName+".result"
                        }
                    }
                }
            }
        })

        agg.contractRules_contracts_per_year.aggs = contractAggs;
        return agg;
    }

    aggs(after_key) {
        let aggs = {};
        // console.log("PartyPipeline aggs",this.flags)

        //Get aggregations for all modules
        this.pipeline.map(step => {
            let parameters = this.processParameters(step);

            let moduleAggs = step.module.getAgg(parameters);
            // console.log("m",Object.keys(moduleAggs)[0])
            // console.log("a",Object.keys(aggs))

            //Unify multiple sub-aggs on the same first-level agg
            // console.log(aggs,moduleAggs);
            if (Object.keys(aggs).indexOf(Object.keys(moduleAggs)[0]) > -1 ) {
                aggs[Object.keys(moduleAggs)[0]].aggs = {... aggs[Object.keys(moduleAggs)[0]].aggs , ... moduleAggs[Object.keys(moduleAggs)[0]].aggs }
            }
            else {
                aggs = { ... aggs , ... moduleAggs};
            }
        })

        let contractAggs = this.generateContractAggs();

        Object.assign(this.baseAggs.parties.aggs, aggs, contractAggs);

        if (after_key.party) {
            // console.log("after_key",after_key)
            this.baseAggs.parties.composite.after = { party: after_key.party};
        }
        // console.log("aggs",JSON.stringify(this.baseAggs));


        return this.baseAggs;
    }

    searchDocument(after_key) {
        let searchDocument = {
            index: this.source,
            size: 0,
            track_total_hits: false, //https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-composite-aggregation.html#_early_termination
            aggs: this.aggs(after_key)

        }
        // console.log("searchDocument buyers aggs", searchDocument.aggs.buyers.aggs);
        return searchDocument;
    }

    getParties(aggregatedSource) {
        return aggregatedSource.aggregations.parties.buckets.map(o => o.key.party)
    }

    out(result) {
        process.stdout.write('\n');
        process.stdout.write(JSON.stringify(result));
    }
}


/*
- EvaluationModules
    - realizan una evaluación específica
    - recibe: valores de campos, valores esperados y condiciones
    - devuelve: EvaluationResult
*/

// Cómo funciona un módulo de evaluación
// 1. Recibe un listado de campos y sus valores, y recibe un listado de valores esperados y sus condiciones.
// 2. Llama al ExpectedValueResolver para resolver los valores esperados
// 3. Realiza su procesamiento sobre los valores de los campos
// 4. Compara el valor procesado con el valor esperado del punto 2
// 5. Crea un EvaluationResult

//Abstract class for evaluation modules
class EvaluationModule {
    static moduleName;
    static params;
    additionalData;

    constructor(rule) {
        if (this.constructor === EvaluationModule) {
            throw new Error("EvaluationModule: Cannot instantiate abstract class");
        }

        // Load additional datasets required by modules
        if(rule && rule.hasOwnProperty('additionalData')) this.loadDatasets(rule.additionalData);


        // console.log("new PartyEvaluationModule",this.constructor)
    }

    evaluate(parameters, rule) {
        // console.log(this,"process");
        let result = new EvaluationResult(rule);
        return this.calculateResult(parameters,result);

    }

    validate(parameters) {}

    loadDatasets(datasets) {
        if (DSLParser.preprocess == true) {
            console.log("Skip loading datasets on preprocess for",this.constructor.moduleName);
            return;
        }

        // console.log("loadDatasets",datasets);
        this.additionalData = {};
        datasets.map( d => {
            let data = null;
            switch(d.type) {
                case 'json':
                    data = JSON.parse(fs.readFileSync('modules/datasets/' + d.path, 'utf8'));
                    break;
            }
            this.additionalData[d.id] = data;
        } );
    }
}


//Abstract class for party evaluation modules
class PartyEvaluationModule extends EvaluationModule {
    preprocessed = {}

    constructor(rule) {
        super(rule)
    }

    getAgg() { return {} }

    preprocess() {}

    getPreprocessed() {
        return this.preprocessed;
    }

    getClient() {
        return PartyPipelineIterator.getClient()
    }

}


/*
- ExpectedValueResolver
    - recibe un listado de valores esperados con condiciones asociadas, y el valor del campo sobre el que se aplica la condición
    - evalúa las condiciones para obtener el valor esperado correcto para el caso
    - devuelve el valor esperado
*/
class ExpectedValueResolver {
    constructor(expectedValues, fieldValue) {
        return value;
    }
}

/*
- ConditionEvaluator
    - recibe un listado de condiciones, simples o anidadas
    - construye una función de evaluación de las condiciones recibidas
    - la función de evaluación recibe un valor y aplica las condiciones, devuelve true o false
*/
class ConditionEvaluator {
    operators = {
        'lte': '<=',
        'lt': '<',
        'gt': '>',
        'gte': '>=',
        'min_count': '>=',
        'eq': '==',
        'ne': '!=',
        'and': '&&',
        'or': '||'
    };
    expression = '';

    constructor(conditions) {
        this.expression = this.parseConditions(conditions).join(' ');
    }

    parseConditions(conditions) {
        let evalStack = [];
        let token = Object.keys(conditions)[0];

        switch(token) {
            case 'and':
            case 'or':
                evalStack.push('(');
                let subexpr = conditions[token];
                let substack = [];
                subexpr.map( se => {
                    substack.push( this.parseConditions(se).join(' ') );
                } );
                evalStack.push( substack.join(' ' + this.operators[token] + ' ') )
                evalStack.push(')');
                break;
            default:
                evalStack.push('(');
                evalStack.push('[VAL]');
                evalStack.push(this.operators[token]);
                evalStack.push(conditions[token]);
                evalStack.push(')');
                break;
        }

        return evalStack;
    }

    evaluate(value) {
        if(typeof value === "string") value = '"' + value + '"';
        return eval( this.expression.replace(/\[VAL\]/g, value) );
    }
}

/*
- EvaluationResult
    - cada posible resultado de un EvaluationModule debe tener un tipo propio
    - los tipos implementan los valores que resultan de una evaluación
    - se puede tener 0/1, enums, o un valor decimal
*/
class EvaluationResult {
    result = null;
    years = []
    rule = null;
    category = null;
    default = null;
    details = null;

    constructor(rule) {
        // console.log("EvaluationResult",rule);
        this.rule = rule.name;
        this.category = rule.category;
        this.default = rule.default;
        this.result = this.default;
        // this.summarization = rule.summarization;
        this.details = {};
    }

    getResult() {

        let obj = {
            rule: this.rule,
            category: this.category,
            result: this.result,
        };
        if(Object.keys(this.details).length > 0) Object.assign(obj, { details: this.details });

        //Result is an average of yearly results if we have years
        if(this.years.length > 0) {
            // console.log(this.years);
            if (obj.category == "contract-count") {

                obj.result = this.years.map(a => a.value).reduce((a,b)=> a+b );
            }
            else {

                obj.result = this.years.map(a => a.value).reduce((a,b)=> a+b ) / this.years.length;
            }
            Object.assign(obj, { years: this.years });
        }

        return obj;
    }

    setResult(result) {
        // console.log(this,result);
        this.result = result;
    }

    setResultYear(result,year) {
        // console.log(this,result);
        this.years.push({year: year, value: result})
    }

    addResultDetails(name, value) {
        if(!this.details.hasOwnProperty(name)) this.details[name] = value;
    }

    fail() { this.result = 0 }
    pass() { this.result = 1 }
    fail_year(year, detail_name, detail_value) { this.years.push({year: year, value: 0, [detail_name]: detail_value }); }
    pass_year(year, detail_name, detail_value) { this.years.push({year: year, value: 1, [detail_name]: detail_value }); }
}

/*
- ContractEvaluation
    - Array de EvaluationResult
    - EvaluationSummary
    - ContractDescription
*/
class EvaluationSummary {
    description = {};
    summary = {};
    summary_years = {};
    results = new Map()

    constructor() {
    }

    addResult(result) {
        let resultData = result.getResult();
        this.results.set(resultData.rule,resultData);
        // console.log(this.results);
        // process.exit(0);
    }
    addDescription(description) {
        this.description = description;
    }

    async addResultsFromPipeline(evaluationPromises) {
        let self = this;
        // console.log("addResultsFromPipeline",evaluationPromises);
        //{party: party, agg: aggregatedSource}
        // return Promise.all(evaluationPromises).then(function(results) {
        let results = await Promise.all(evaluationPromises);
            // console.log(results);

            //We have an array of results from the promises
            results.map(result => {
                if (result) {
                    // console.log("addResultsFromPipeline");

                    self.addResult(result);
                }
                else {
                    console.error("Unexpected result",results);
                    process.exit(1)
                }
            })
        // })
        // .catch(e => {
        //     console.error("addResultsFromPipeline: Falsas promesas",e);
        //     process.exit(1);
        // })

        // console.log(evaluation.getEvaluation());

    }


    calculateSummaries() {
        let categories = {}
        let years = {}

        this.results.forEach(r => {
            // console.log("calculateSummaries",r.category);
            if (!categories[r.category]) {
                categories[r.category] = { total:0, count: 0}
            }

            categories[r.category].total += r.result;
            categories[r.category].count ++;


            if (r.years) {
                for (let y in r.years) {
                    let year = r.years[y].year;

                    if (!years[year]) {
                        years[year] = {
                            categories: {}
                        }
                    }


                    if (!years[year].categories[r.category]) {
                        years[year].categories[r.category] = { total:0, count: 0}
                    }

                    years[year].categories[r.category].total += r.years[y].value;
                    years[year].categories[r.category].count ++;

                }
            }
        })
        Object.keys(categories).map(c => {
            // console.log(c,c == "contract-count",categories[c].total)
            if (c == "contract-count") {
                this.summary[c] = categories[c].total;
            }
            else {
                this.summary[c] = categories[c].total / categories[c].count;
            }
        })

        Object.keys(years).map(y => {
            let year = y;

            Object.keys(categories).map(category => {
                if (years[year].categories[category]) {

                    let year_category_score;
                    // console.log(category);
                    if (category == "contract-count") {
                        year_category_score = years[year].categories[category].total;
                    }
                    else {
                        year_category_score = years[year].categories[category].total / years[year].categories[category].count;
                    }

                    if (!this.summary_years[year]) {
                        this.summary_years[year] = {}
                    }
                    this.summary_years[year][category] = year_category_score;
                }
            })
        })

        //Hide years with only network (banderas-ecuador issue#23)
        Object.keys(this.summary_years).map(y => {
            let year = this.summary_years[y];
            let year_categories = Object.keys(year);
            // console.log(y,year,year_categories,year_categories.length);
            if (year_categories.length == 1 && year.network) {
                delete this.summary_years[y];
            }
        })


        // let summaryall;
        let summarysum = 0;
        let summarycount = 0;
        Object.keys(this.summary).map(s => {
            if (s != "contract-count") {

                summarysum += this.summary[s];
                summarycount++;
            }
        })
        //Calculate total score
        // let summaryvalues = Object.values(summaryall);
        // let summarysum = summaryvalues.reduce((a,b) => a+b);
        this.summary.total_score = summarysum / summarycount;
    }

    getEvaluation() {
        this.calculateSummaries();

        return {
            description: this.description,
            summary: this.summary,
            summary_years: this.summary_years,
            results: Object.fromEntries(this.results)

        };
    }

    outDescription() {
        let out = "\n'";
        Object.keys(this.description).map(d => {
            out+= this.description[d]+"','";
        });

        return out;

    }
    getSummaryCSV() {
        //Output summary_years
        //Data Structure:
        // "summary":{"traz":0.6666666666666666,"network":0.7595463900011885,"comp":0.5,"total_score":0.642071018889285},
        // {
        //     traz: 0.8484848484848484,
        //     network: 0.7653070091366005,
        //     comp: 0.7916666666666667,
        //     'contract-count': 13,
        //     trans: 0.9583333333333334,
        //     temp: 0.625,
        //     total_score: 2.8314653096035745
        //   }

        // "summary_years":{"2015":{"traz":0.5,"comp":0.5},"2016":{"traz":0.5,"comp":0.5},"2017":{"comp":1},"2018":{"traz":0.5,"comp":0.5},"2019":{"comp":1},"2020":{"comp":1},"2021":{"traz":0.5,"comp":0.5},"2022":{"comp":1}},
        this.calculateSummaries();
        // console.log(this.summary);
        let out = "";

        ["total_score", "network", "contract-count"].map(category => {

            out += this.outDescription();

            out += category+"',"+this.summary[category]+",'all'";
        })

        let years = Object.keys(this.summary_years);
        for (let y in years) {
            let year = years[y];
            let categories = Object.keys(this.summary_years[year]);
            for (let c in categories) {
                let category = categories[c];
                // console.log(categories,category);
                let categoryValue = this.summary_years[year][category];

                out += this.outDescription();

                out += category+"',"+categoryValue+","+year;
            }
        }
        return out;
    }
    getEvaluationCSV() {
        //Output result per year per party
        //Data Structure:
        // {"description":{"party":" \t GOBIERNO AUTONOMO PARROQUIAL DE SINAI","region":"MORONA SANTIAGO","locality":"MORONA","role":"buyer"},
        //"results":[{"rule":"duplicated-id","category":"traz","result":1},{"rule":"network","category":"network","result":0.7595463900011885},{"rule":"title-contract-repeated","category":"traz","result":0,"years":[{"year":"2015","value":0,"maxValuesRatio":0.6470588235294118},{"year":"2016","value":0,"maxValuesRatio":0.5806451612903226},{"year":"2018","value":0,"maxValuesRatio":0.5675675675675675},{"year":"2021","value":0,"maxValuesRatio":0.9230769230769231}]},{"rule":"above-average-number-contracts","category":"comp","result":0,"years":[{"year":"2015","value":0,"maxValuesRatio":0.6470588235294118},{"year":"2016","value":0,"maxValuesRatio":1},{"year":"2018","value":0,"maxValuesRatio":0.8918918918918919},{"year":"2021","value":0,"maxValuesRatio":0.9230769230769231}]},{"rule":"contract-amount-repeated","category":"traz","result":1,"years":[{"year":"2015","value":1,"maxValuesRatio":0.029411764705882353},{"year":"2016","value":1,"maxValuesRatio":0.03225806451612903},{"year":"2018","value":1,"maxValuesRatio":0.05405405405405406},{"year":"2021","value":1,"maxValuesRatio":0.038461538461538464}]},{"rule":"one-few-bidders-win-disproportionate-number-contracts-same-type","category":"comp","result":1,"years":[{"year":"2015","value":1},{"year":"2016","value":1},{"year":"2017","value":1},{"year":"2018","value":1},{"year":"2019","value":1},{"year":"2020","value":1},{"year":"2021","value":1},{"year":"2022","value":1}]}]}
        let out = "";
        // console.log("values",this.results.values());
        this.results.forEach(result => {


            if (result.years) {
                for (let y in result.years) {
                    let year = result.years[y];

                    out += this.outDescription();
                    out += result.rule+"','"+result.category+"',"+result.result+",";

                    out += year.year+","+year.value;
                    // console.log(result.years[y],out);
                    // process.exit();
                }
            }
            else {
                out += this.outDescription();
                out += result.rule+"','"+result.category+"',"+result.result+",'";
                out += "all',''"
            }
        })



        return out;


    }


}


module.exports = { DSLParser, EvaluationSummary, EvaluationModule, PartyPipelineIterator, PipelineIterator, PartyEvaluationModule, EvaluationResult, ConditionEvaluator }
