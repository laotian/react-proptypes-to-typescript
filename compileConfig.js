const referenceTypes =  ["this\\.produceModel\\((\\w+)\\)",   "this\\.produceUIModel\\((\\w+)\\)"];
const blackListProperties = ["listViewType","needsPullDownToRefresh","needsPullUpToLoadMore","refreshingType","_renderFooterView","_listView","pageSize","emotionViewState","ipViewState","UIModel", "navigationBar","isListView"];

module.exports =  {
    react: {
        reactClassValidator: function(superClassName) {
            if(superClassName) {
                return /\w+BaseComponent|\w+BaseContainer|\w+BaseListContainer/.test(superClassName);
            }
            return false;
        }
    },
    classProperty: {
        propertyNameValidator: function(className, propertyName) {
            return !blackListProperties.includes(propertyName);
        },
        customReferenceType: function(className, express) {
            for( let rt of referenceTypes) {
                let  match = express.match(new RegExp(rt));
                if (match) {
                    return  match[1];
                }
            }
            return undefined;
        }
    }
}