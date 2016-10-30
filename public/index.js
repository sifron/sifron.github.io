require(["dojo/parser",
         "dojo/_base/array",
         "dojo/on",
         "dojo/dom",
         "dojo/dom-construct",
         "dojo/dom-style",
         "esri/lang",
         "esri/map",
         "esri/graphic",
         "esri/tasks/query",
         "esri/InfoTemplate",
         "esri/dijit/InfoWindow",
         "esri/dijit/Legend",
         "esri/dijit/Search",
         "esri/geometry/Circle",
         "esri/layers/FeatureLayer",
         "esri/symbols/SimpleMarkerSymbol",
         "esri/symbols/SimpleLineSymbol",
         "esri/symbols/SimpleFillSymbol",
         "esri/renderers/SimpleRenderer",
         "esri/renderers/ClassBreaksRenderer",
         "esri/Color",
		 "esri/request",
         "dijit/TooltipDialog",
         "dijit/popup",
         "dijit/form/Form",
         "dijit/form/TextBox",
         "dijit/form/NumberTextBox",
         "dijit/form/Button",
         "dijit/DropDownMenu",
         "dijit/MenuItem",
         "dijit/layout/BorderContainer",
         "dijit/layout/ContentPane",
         "dijit/layout/AccordionContainer",
		 "dojo/domReady!"], 
        function(Parser, arr, on, dom, domConstruct, domStyle, esriLang, Map, Graphic, Query, InfoTemplate, InfoWindow, Legend, Search, 
                  Circle, FeatureLayer, SMS, SLS, SFS, SimpleRenderer, ClassBreaksRenderer, Color, EsriRequest, TooltipDialog, dijitPopup){
    Parser.parse();
    
	var map = new Map("map", {
		basemap: "topo",
		center: [-73.950, 40.702],
		zoom: 11
    });
    
    dialog = new TooltipDialog({
        id: "tooltipDialog",
        style: "position: absolute; width: 250px;"
    });
    dialog.startup();
    
    var zips = new FeatureLayer("https://services1.arcgis.com/1L9nSO7QmA3AYgYY/arcgis/rest/services/zip_codes/FeatureServer/0",
                                {outFields: ["GEOid2"]});
    var ratings = new FeatureLayer("https://services7.arcgis.com/rY0j0cItaYX4ogFB/arcgis/rest/services/User_Rating/FeatureServer/0",
                                  {outFields: ["*"]});
    
    zips.on("mouse-over", function(evt){
        var data = datastore[currentDisplay];
        var fieldName = fieldToName(currentDisplay);
        var template;
        if(fieldName === "General Information"){
            template = "<b>Zip Code: ${GEOid2}</b><hr>" +
                "<b>Population:</b> " + data[evt.graphic.attributes.GEOid2][0].toFixed(2) + "<br/>" +
                "<b>Square Miles:</b> " + data[evt.graphic.attributes.GEOid2][1].toFixed(2) + "<br/>" +
                "<b>Population Density:</b> " + data[evt.graphic.attributes.GEOid2][2].toFixed(2) + "<br/>" +
                "<b>Unemployment:</b> " + data[evt.graphic.attributes.GEOid2][3].toFixed(2) + "<br/>";
        } else {
            template = "<b>Zip Code: ${GEOid2}</b><hr>" +
            "<b>" + fieldName + ":</b> " + data[evt.graphic.attributes.GEOid2][0].toFixed(2);
        }
        var content = esriLang.substitute(evt.graphic.attributes, template);
        dialog.setContent(content);
        domStyle.set(dialog.domNode, "opacity", 0.85);
        dijitPopup.open({popup: dialog, x: evt.pageX, y: evt.pageY});
    });
    
    ratings.on("mouse-over", function(evt){
        template = "<b>User Rating</b><hr>" +
                "<b>Rating: ${User_Rating}</b>";
        var content = esriLang.substitute(evt.graphic.attributes, template);
        dialog.setContent(content);
        domStyle.set(dialog.domNode, "opacity", 0.85);
        dijitPopup.open({popup: dialog, x: evt.pageX, y: evt.pageY});
    });
    
    ratings.on("mouse-out", function(evt){
        dijitPopup.close(dialog);
    });
    
    zips.on("mouse-out", function(evt){
        dijitPopup.close(dialog);
    });
    
    var ratingSymbol = new SMS(SMS.STYLE_CIRCLE, 12, 
                               new SLS(SLS.STYLE_NULL, new Color([247, 34, 101, 0.9]), 1), 
                               new Color([207, 34, 171, 0.5]));
    ratings.setSelectionSymbol(ratingSymbol);
    
    var nullSymbol = new SMS().setSize(0);
    ratings.setRenderer(new SimpleRenderer(nullSymbol));
    
    map.addLayer(zips);
    map.addLayer(ratings);
    
    var circleSymb = new SFS(SFS.STYLE_NULL,
                            new SLS(SLS.STYLE_SHORTDASHDOTDOT, 
                                   new Color([105, 105, 105]), 2),
                            new Color([255, 255, 0, 0.25]));
    var circle;
    
    map.on("click", function(evt){
        circle = new Circle({
            center: evt.mapPoint,
            geodesic: true,
            radius: 3,
            radiusUnit: "esriMiles"
        });
        map.graphics.clear();
        map.infoWindow.hide();
        var graphic = new Graphic(circle, circleSymb);
        map.graphics.add(graphic);
        
        var query = new Query();
        query.geometry = circle.getExtent();
        ratings.queryFeatures(query, selectInBuffer);
    });
    
    function selectInBuffer(response)
    {
        var feature;
        var features = response.features;
        var inBuffer = [];
        
        for(var i = 0; i < features.length; i++) {
            feature = features[i];
            if(circle.contains(feature.geometry)){
                inBuffer.push(feature.attributes[ratings.objectIdField]);
            }
        }
        var query = new Query();
        query.objectIds = inBuffer;
        ratings.selectFeatures(query, FeatureLayer.SELECTION_NEW, function(results){
            //console.log(results);
        });
    }
    
    var legend = new Legend({
        map: map,
        layerInfos: [{"layer": zips, "title": "Rent Rating"}]
    }, "legendDiv");
    legend.startup();
    
    var datastore, currentDisplay;
    var prices = EsriRequest({
        url: "http://localhost:3000/csv",
        handleAs: "json"
    });
    prices.then(loadData);
    
    function loadData(data)
    {
        datastore = data;
        drawFeatureLayer("one", 0);
    }
    
    function drawFeatureLayer(field, index)
    {
        currentDisplay = field;
        zips.redraw();
        data = datastore[field];
        var min = minValue(data, index);
        var max = maxValue(data, index);
        var breaks = calcBreaks(min, max, 4);
        var outline = new SLS("solid", new Color("#444"), 1);
        var br = new ClassBreaksRenderer(null, function(g){
            return data[g.attributes.GEOid2][index];
        });
        br.addBreak(breaks[0].toFixed(2), breaks[1].toFixed(2), new SFS("solid", outline, new Color("#d8e8f3")));
        br.addBreak(breaks[1].toFixed(2), breaks[2].toFixed(2), new SFS("solid", outline, new Color("#9fc5e0")));
        br.addBreak(breaks[2].toFixed(2), breaks[3].toFixed(2), new SFS("solid", outline, new Color("#5296c7")));
        br.addBreak(breaks[3].toFixed(2), max.toFixed(2), new SFS("solid", outline, new Color("#2c6187")));
        
        zips.setRenderer(br);
        zips.redraw();
        var title;
        if(field === "general"){
            title = fieldToName("general", index);
        } else {
            title = "Rent rating";
        }
        legend.layerInfos[0].title = title;
        legend.refresh();
    }
    
    window.drawFeatureLayer = drawFeatureLayer;
    
    function submitRating(address, rating){
        var search = new Search();
        search.startup();
        var result = search.search(address);
        var location;
        result.then(function(result){
            location = result;
            search.destroy();
            var point = result[0][0].feature.geometry;
            var attr = {"User_Rating": rating};
            var infoTemplate = new InfoTemplate("User Rating", "Rating: ${User_Rating}");
            var graphic = new Graphic(point, null, attr, infoTemplate);
            ratings.applyEdits([graphic], null, null, function(adds){
                console.log(adds);
            }, function(err){
                console.log(err);
            });
        });
    }
    
    window.submitRating = submitRating;
    
    function minValue(obj, index)
    {
        var min = Infinity;
        for(var key in obj){
            if(obj[key][index] < min){
                min = obj[key][index];
            }
        }
        return min;
    }
    
    function maxValue(obj, index)
    {
        var max = -Infinity;
        for(var key in obj){
            if(obj[key][index] > max){
                max = obj[key][index];
            }
        }
        return max;
    }
    
    function calcBreaks(min, max, n)
    {
        var range = (max - min) / n;
        var breakValues = [];
        for (var i = 0; i < n; i++)
            {
                breakValues[i] = min + (range * i);
            }
        return breakValues;
    }
    
    function fieldToName(field, index)
    {
        var returnValue;
        switch(field){
            case "studio":
                returnValue = "Studio Apartments";
                break;
            case "one":
                returnValue = "One Bedroom";
                break;
            case "two":
                returnValue = "Two Bedroom";
                break;
            case "three":
                returnValue = "Three Bedroom";
                break;
            case "four":
                returnValue = "Four Bedroom";
                break;
            case "five":
                returnValue = "Five Bedroom";
                break;
            case "general":
                switch(index){
                    case 0:
                        returnValue = "Population";
                        break;
                    case 1:
                        returnValue = "Square Miles";
                        break;
                    case 2:
                        returnValue = "Population Density";
                        break;
                    case 3:
                        returnValue = "Unemployment"
                        break;
                    default:
                        returnValue = "General Information";
                }
                break;
            default:
                returnValue = "unexpected field";
        }
        return returnValue;
    }
});
