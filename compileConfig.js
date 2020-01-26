const referenceTypes =  [
    "this\\.produceModel\\((\\w+)\\)",
    "this\\.produceUIModel\\((\\w+)\\)"
];

const blackListProperties = [
    "listViewType",
    "needsPullDownToRefresh",
    "needsPullUpToLoadMore",
    "refreshingType",
    "_renderFooterView",
    "_listView",
    "pageSize",
    "emotionViewState",
    "ipViewState",
    "UIModel",
    "navigationBar",
    "isListView"
];

const blackListModelProperties = [
    "url",
    "mParams",
    "customAction",
    "loadingStyle",
    "isTrackClickParams",
    "eventName",
    "containerTag",
    "loadType",
    "isLoading",
    "requestBeginTime",
    "requestEndTime",
    "dataParseTime",
    "traceID",
    "networkChannel"
];

module.exports =  {
    react: {
        reactClassValidator: function(superClassName) {
            if(superClassName) {
                return /\w+BaseComponent|\w+BaseContainer|\w+BaseListContainer/.test(superClassName);
            }
            return false;
        },
        stateNameValidator: function(superClassName, stateName) {
            if(superClassName){
                return ![
                    "dataSource",
                    "hasMore",
                    "isRefreshing",
                    "isLoadingMore",
                    "useSectionList",
                    "renderBackgroundView",
                    "ListViewCommon",
                    "RDFListView"
                ].includes(stateName);
            }
            return true;
        }
    },
    classProperty: {
        propertyNameValidator: function(superClassName, propertyName) {
            if(superClassName && superClassName.indexOf("BaseModel")>0){
                return !blackListModelProperties.includes(propertyName);
            }
            return !blackListProperties.includes(propertyName);
        },
        customReferenceType: function(superClassName, express) {
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