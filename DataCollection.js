/**
 * Query against data collections
 * */
class Query{

    /**
     * creates a query against the data collection
     * @param {DataCollection} dataCollection
     * */
    constructor(dataCollection){
        this.actions = [];
        this.dataCollection = dataCollection;
    }

    /**
     * @private
     * @param {String} action
     * @param {Object} settings
     * @param {Array} [use] collection to use
     * */
    async _do(action, settings, use= undefined){
        return new Promise(((resolve, reject) => {
            let message = {};
            message = Object.assign(message, settings);
            message = Object.assign(message,{type: action, use, mid: Date.now().toString(32) + Math.random().toString(32).substring(2,7)});

            this.dataCollection._worker.postMessage(message);

            let listen = e => {
                let m = e.data;
                if(m.mid === message.mid){
                    this.dataCollection._worker.removeEventListener("message", listen);
                    if(m.type === "error") reject({message: m.message, stack: m.cause});
                    resolve(m);
                }
            };
            this.dataCollection._worker.addEventListener("message", listen);

            let waitForResult = setTimeout(() => {
                clearTimeout(waitForResult);
                reject("timeout")
            }, this.dataCollection.timeout);
        }));
    }

    /**
     * @private
     * check if the given operation receives array data, if not, throw an error
     * */
    _checkDataIsArray(data, action="action"){
        if(!data instanceof Array) throw new Error(`Called ${action} after an operation which returned not a part of the collection, but a ${typeof data}`);
    }

    /**
     * executes the query and retrieves the overall result
     * @returns {Promise<*>} the queries result
     * */
    async result(){
        if(!this.dataCollection.isInitialized) await this.dataCollection.waitForInitialization();
        let previousResult = this.dataCollection.data;
        for(let action of this.actions){
            previousResult = (await action(previousResult)).data;
        }
        return previousResult;
    }

    /**
     * get everything with an attribute between the given values (Numbers and Dates as expected, String uses local compare)
     * @param {String} attr the attribute to check
     * @param {*} low the lower bound of acceptable results, low inclusive
     * @param {*} high the higher bound of acceptable results, high inclusive
     * @returns {Query}
     * */
    between(attr, low, high){
        this.actions.push((data) => {
            this._checkDataIsArray(data,"between");
            return this._do("between", {low, high, attr}, data)
        });
        return this;
    }

    /**
     * get everything which attribute is equal to the given value
     * @param {String} attr the attribute to check
     * @param {*} value the value to check
     * @return {Query}
     * */
    equals(attr, value){
        this.actions.push((data) => {
            this._checkDataIsArray(data, "equals");
            return this._do("equals", {attr, value}, data);
        });
        return this;
    }

    /**
     * get everything matching the given regular expression
     * @param {String} attr the attribute to check. Non-String attributes are cast to String
     * @param {RegExp} matches the regular expression describing the attribute
     * @returns {Query}
     * */
    matching(attr, matches){
        this.actions.push((data) => {
            this._checkDataIsArray(data, "matching");
            return this._do("matching", {attr, matches}, data);
        });
        return this;
    }

    /**
     * get a range of everything between the low index and high index (ergo range between 5 and 10 => every result in the collection with an index >= 5 and < 10)
     * @param {Number} low the lowest index
     * @param {Number} high the index directly after the range (highest is high - 1)
     * @returns {Query}
     * */
    range(low, high){
        this.actions.push((data) => {
            if(data instanceof Array){
                return this._do("range", {low, high}, data);
            }else if(data instanceof Object){
                return new Promise(async(resolve) => {
                    for(let group in data){
                        if(data.hasOwnProperty(group)) data[group] = (await this._do("range", {low, high}, data[group])).data;
                    }
                    resolve({data});
                });
            }else{
                throw new Error(`Could not call 'range' since data is neither Array nor Object but ${typeof data}`);
            }
        });
        return this;
    }

    /**
     * Get the collection entry with the given key. The should be unique, if not, the first result is returned
     * @param {String | Number} value the value of the key
     * @param {String} [attr="id"] the key attribute, defaults to id
     * @returns {Query}
     */
    withKey(value, attr="id"){
        this.actions.push((data) => {
            this._checkDataIsArray(data, "withKey");
            return this._do("key", {key: value, attr}, data);
        });
        return this;
    }

    /**
     * Sums up the given attribute
     * @param {String} attr the attribute to sum up
     * @returns {Query}
     * */
    sum(attr){
        this.actions.push((data) => {
            if(data instanceof Array){
                return this._do("sum", {attr}, data);
            }else if(data instanceof Object){
                return new Promise(async(resolve) => {
                    for(let group in data){
                        if(data.hasOwnProperty(group)) data[group] = (await this._do("sum", {attr}, data[group])).data;
                    }
                    resolve({data});
                });
            }else{
                throw new Error(`Could not call 'sum' since data is neither Array nor Object but ${typeof data}`);
            }
        });
        return this;
    }

    /**
     * Average of the given attribute
     * @param {String} attr the attribute to compute the average of
     * @returns {Query}
     * */
    avg(attr){
        this.actions.push((data) => {
            if(data instanceof Array){
                return this._do("avg", {attr}, data);
            }else if(data instanceof Object){
                return new Promise(async (resolve) => {
                    for(let group in data){
                        if(data.hasOwnProperty(group)) data[group] = (await this._do("avg", {attr}, data[group])).data
                    }
                    resolve({data});
                });
            }else{
                throw new Error(`Could not call 'avg' since data is neither Array nor Object but ${typeof data}`);
            }
        });
        return this;
    }

    /**
     * The mean of the given attribute
     * @param {String} attr the attribute to compute the mean of
     * @returns {Query}
     * */
    mean(attr){
        this.actions.push((data) => {
            if(data instanceof Array){
                return this._do("mean", {attr}, data);
            }else if(data instanceof Object){
                return new Promise(async (resolve) => {
                    for(let group in data){
                        if(data.hasOwnProperty(group)) data[group] = (await this._do("mean", {attr}, data[group])).data
                    }
                    resolve({data});
                });
            }else{
                throw new Error(`Could not call 'mean' since data is neither Array nor Object but ${typeof data}`);
            }
        });
        return this;
    }

    /**
     * all entries of the collection
     * @param {String | Array<String>} [sortBy=[]] a list of attributes to sort by. Add '+' for ascending and '-' for descending in front of the attributes names
     * @returns {Query}
     * */
    all(sortBy=[]){
        if(typeof sortBy === "string") sortBy = [sortBy];
        this.actions.push((data) => {
            this._checkDataIsArray(data, "all");
            return this._do("range", {sortBy}, data);
        });
        return this;
    }

    /**
     * sort all entries according to the given attributes
     * @param {String | Array<String>} attributes a list of attributes to sort by. Add '+' for ascending and '-' for descending in front of the attributes names
     * @returns {Query}
     * */
    sortBy(attributes){
        if(typeof attributes === "string") attributes = [attributes];
        this.actions.push((data) => {
            if(data instanceof Array){
                return this._do("all", {sortBy: attributes}, data);
            }else if(data instanceof Object){
                return new Promise(async (resolve) => {
                    for(let group in data){
                        if(data.hasOwnProperty(group)) data[group] = (await this._do("all", {sortBy: attributes}, data[group])).data
                    }
                    resolve({data});
                });
            }else{
                throw new Error(`Could not call 'mean' since data is neither Array nor Object but ${typeof data}`);
            }
        });
        return this;
    }

    /**
     * builds a set of entries of the current query or the given one
     * @param {Query} query
     * @returns {Query}
     * */
    or(query){
        this.actions.push(async (data) => {
            this._checkDataIsArray(data, "or");
            let union = await query.result();
            return this._do("or", {union}, data);
        });
        return this;
    }

    /**
     * builds a set of entries of the current query and the next one. Yields only entries which are in both queries.
     * @param {Query} query
     * @returns {Query}
     * */
    and(query){
        this.actions.push(async (data) => {
            this._checkDataIsArray(data, "and");
            let intersect = await query.result();
            return this._do("and", {intersect}, data);
        });
        return this;
    }

    /**
     * get the inverted set of data, ergo all without the previous query result
     * @returns {Query}
     * */
    invert(){
        this.actions.push((data) => {
            this._checkDataIsArray(data, "invert");
            return this._do("invert", {}, data);
        });
        return this;
    }

    /**
     * group entries according to given attribute
     * @param {String} attr the attribute to group entries
     * */
    groupBy(attr){
        this.actions.push((data) => {
            this._checkDataIsArray(data, "groupBy");
            return this._do("groupBy", {attr}, data);
        });
        return this;
    }

    /**
     * define data to use when the current query results in null, undefined or an empty array
     * @param {*} data
     * @returns {Query}
     * */
    fallbackIfEmpty(data){
        this.actions.push((data) => {
            if(data === null || data === undefined || (data instanceof Array && data.length === 0)){
                return Promise.resolve(data);
            }

            return data;
        })
    }

}

class DataCollection{

    constructor({file, timeout, workerDir}){
        this.timeout = timeout || 5000;
        this.isInitialized = false;
        if(file.startsWith("./")) file = file.substring(2);
        file = window.location.origin + window.location.pathname.split("/").slice(0,-1).join("/") + "/" + file;
        this.workerDir = workerDir || "./";
        if(!this.workerDir.endsWith("/")) this.workerDir += "/";
        this._worker = new Worker(this.workerDir + "worker.js");
        this._worker.postMessage({type: "load", mid: 1, file});
        this._worker.addEventListener("message", (e) => {
            let message = e.data;
            if(message.type !== "load") return;
            this.isInitialized = true;
            this._onInit.forEach(fn => fn(message.data));
            this.data = message.data;
        });
        this.data = [];
        this._onInit = [];
    }

    onInit(fn){
        return this.isInitialized ? fn(this.data) : this._onInit.push(fn);
    }

    waitForInitialization(){
        return new Promise((resolve) => {
            this.onInit(resolve);
        });
    }

    withKey(key, attr){
        return new Query(this).all().withKey(key, attr);
    }

    equals(attr, value){
        return new Query(this).all().equals( attr, value);
    }

    all(sortBy=[]){
        return new Query(this).all(sortBy);
    }

    between(attr, low, high){
        return new Query(this).between(attr, low, high);
    }

    matching(attr, matches){
        return new Query(this).all().matching(attr, matches);
    }

    sortBy(attributes){
        return new Query(this).sortBy(attributes);
    }

    groupBy(attr){
        return new Query(this).all().groupBy(attr);
    }

}