

self.addEventListener("message", async function onMessage(e){
    const message = e.data;
    const data = e.data.use || self.collection;

    function handle(fn){
        self.postMessage({type: message.type, mid: message.mid, data: fn(data, message) }, undefined);
    }

    switch(message.type){
        case "load":
            loadCollection(message.file).then(data => handle(() => data));
            break;
        case "all":
            handle((data, message) => getSorted(data, message.sortBy));
            break;
        case "between":
            handle((data, message) => getBetween(data, message.attr, message.low, message.high));
            break;
        case "matching":
            handle((data, message) => getMatching(data, message.attr, message.matches));
            break;
        case "equals":
            handle((data, message) => equals(data, message.attr, message.value, message.ignoreCase));
            break;
        case "range":
            handle((data, message) => data.slice(message.low || 0, message.high || data.length));
            break;
        case "key":
            handle((data, message) => findByKey(data, message.key, message.attr));
            break;
        case "sum":
            handle((data, message) => data.reduce((s, m) => s+m[message.attr], 0));
            break;
        case "avg":
            handle((data, message) => data.reduce((s, m) => s+m[message.attr], 0)/data.length);
            break;
        case "groupBy":
            handle((data, message) => getGrouped(data, message.attr));
            break;
        case "exec":
            handle((data, message) => exec(data, new Function(message.fn)));
            break;
        case "and":
            handle((data, message) => intersect(data, message.intersect, message.key, message.attr));
            break;
        case "or":
            handle((data, message) => union(data, message.union, message.attr));
            break;
        default:
            self.postMessage({type: "error", mid: message.mid, message: "unknown type "+message.type, cause: message}, undefined);

    }
});

function findByKey(list, key, attr){
    if(!key) key = "id";
    let i = list.findIndex(m => m[attr] === key);
    return i >= 0 ? list[0] : null;
}

function equals(list, attr, value, ignoreCase = true){
    return list.filter(entry => {
        if(typeof value === "string" && ignoreCase){
            return entry[attr]?.toLowerCase() === value.toLowerCase();
        }

        return entry[attr] === value;
    });
}

function union(a, b, attr){
    if(!attr) attr = "id";
    b.forEach(bEl => {
        if(a.findIndex(aEl => aEl[attr] === bEl[attr]) === -1) a.push(bEl);
    });
    return a;
}

function intersect(a, b){
    return a.filter(aEl => b.findIndex(bEl => bEl.id === aEl.id) >= 0);
}

function getSorted(list, ordering, immutable=true){
    if(immutable) list = list.slice();
    list.sort((a, b) => {
        for(let attr of ordering){
            let orderFactor = attr.startsWith("-") ? -1 : 1;
            if(attr.startsWith("+") || attr.startsWith("-")) attr = attr.substring(1);
            let aVal = a[attr];
            let bVal = b[attr];

            if(aVal === bVal) continue;

            if(typeof aVal === "number" && typeof bVal === "number")return (aVal - bVal) * orderFactor;

            if(aVal && bVal && (typeof aVal === "string" || typeof bVal === "string")) return (aVal.toString().localeCompare(bVal.toString())) * orderFactor;

            if(!aVal) return -1;

            if(!bVal) return 1;
        }
        return 0;
    });
    return list;
}

function getGrouped(list, attr){
    return list.reduce((groups, entry) => {
        // if group not existing, create new, empty group
        if(!groups[entry[attr]]) groups[entry[attr]] = [];

        groups[entry[attr]].push(entry);

        return groups;
    }, {});
}

function getBetween(list, attr, low, high){
    return list.filter(m => m[attr] >= low && m[attr] <= high);
}

function getMatching(list, attr, regex){
    regex = new RegExp(regex);
    return list.filter(m => regex.test(m[attr].toString()));
}

async function loadCollection(file){
    let data;
    try{
        // step 1: load json file via fetch HTTP GET Request and parse its body to json
        let response = await fetch(file);
        data = await response.json();

        // step 2: sanitize data
        data.forEach(movie => {
            movie.genres = eval(movie.genres);
            movie.release_data = new Date(movie.release_data);
        });

        // set data (so we do not have to request it again and again)
        self.collection = data;
        return data;
    }catch (err) {
        self.postMessage({type: "error", message: err.message, cause: err.stack}, undefined);
    }
}

async function exec(list, fn){
    return fn(list);
}