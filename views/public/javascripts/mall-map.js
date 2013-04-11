$(document).ready(function () {
    
    var MAP_URL_TEMPLATE = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    var MAP_CENTER = [38.8891, -77.02949];
    var MAP_ZOOM = 15;
    var MAP_MIN_ZOOM = 14;
    var MAP_MAX_ZOOM = 18;
    var MAP_MAX_BOUNDS = [[38.79164, -77.17232], [38.99583, -76.90917]];
    var LOCATE_BOUNDS = [[38.87814, -77.05656], [38.90025, -77.00678]];
    
    var map;
    var historicMapLayer;
    var geoJsonLayer;
    var jqXhr;
    var locationMarker;
    
    // Set the base map layer.
    map = L.map('map', {
        center: MAP_CENTER, 
        zoom: MAP_ZOOM, 
        minZoom: MAP_MIN_ZOOM, 
        maxZoom: MAP_MAX_ZOOM, 
        maxBounds: MAP_MAX_BOUNDS, 
        zoomControl: false, 
    });
    map.addLayer(L.tileLayer(MAP_URL_TEMPLATE));
    map.addControl(L.control.zoom({position: 'bottomright'}));
    map.attributionControl.setPrefix('');
    
    // Locate the user.
    map.locate({watch: true});
    
    // Retain previous form state, if needed.
    retainFormState();
    
    // Add all markers by default, or retain previous marker state.
    doFilters();
    
    // Log the clicked coordinates.
    map.on('click', function (e) {
        console.log("Map clicked at zoom " + map.getZoom() + '; ' + e.latlng);
    });
    
    // Handle location found.
    map.on('locationfound', function (e) {
        // User within location bounds. Set the location marker.
        if (L.latLngBounds(LOCATE_BOUNDS).contains(e.latlng)) {
            if (locationMarker) {
                // Remove the existing location marker before adding to map.
                map.removeLayer(locationMarker);
            } else {
                // Pan to location only on first locate.
                map.panTo(e.latlng);
            }
            $('#locate-button').removeClass('disabled');
            locationMarker = L.marker(e.latlng);
            locationMarker.addTo(map).
                bindPopup("You are within " + e.accuracy / 2 + " meters from this point");
        // User outside location bounds.
        } else {
            map.stopLocate();
            $('#locate-button').addClass('disabled');
            var miles = Math.ceil((e.latlng.distanceTo(map.options.center) * 0.000621371) * 100) / 100;
            $('#dialog').text('Location out of bounds. You are ' + miles + ' miles away.').
                dialog('option', 'title', 'Out of Bounds').
                dialog('open');
        }
    });
    
    // Handle location error.
    map.on('locationerror', function () {
        map.stopLocate();
        $('#locate-button').addClass('disabled');
        $('#dialog').text('Could not find your location.').
            dialog('option', 'title', 'Location Not Found').
            dialog('open');
    });
    
    // Set up the dialog window.
    $('#dialog').dialog({autoOpen: false});
    
    // Handle the filter form.
    $('#filter-button').click(function(e) {
        e.preventDefault();
        var filterButton = $(this);
        var clicks = filterButton.data('clicks');
        if (clicks) {
            filterButton.removeClass('on').
                find('.screen-reader-text').
                html('Filters');
            $('#filters').animate({left: '+=100%'}, 200, 'linear');
        } else {
            filterButton.addClass('on').
                find('.screen-reader-text').
                html('Back to Map');
            $('#filters').animate({left: '-=100%'}, 200, 'linear');
        }
        filterButton.data('clicks', !clicks);
    });
    
    // Revert form to default and display all markers.
    $('#all-button').click(function(e) {
        e.preventDefault();
        revertFormState();
    });
    
    // Handle locate button.
    $('#locate-button').click(function (e) {
        e.preventDefault();
        if ($(this).hasClass('disabled')) {
            return;
        }
        if (locationMarker) {
            map.removeLayer(locationMarker)
            locationMarker = null;
        }
        map.stopLocate();
        map.locate({watch: true});
    });
    
    // Toggle historic map layer on and off.
    $('#toggle-map-button').click(function (e) {
        e.preventDefault();
        var toggleMapButton = $(this);
        var clicks = toggleMapButton.data('clicks');
        if (clicks) {
            toggleMapButton.addClass('on');
            toggleMapButton.find('.screen-reader-text').html('Map On');
            map.addLayer(historicMapLayer);
        } else {
            if (historicMapLayer) {
                toggleMapButton.removeClass('on');
                toggleMapButton.find('.screen-reader-text').html('Map Off');
                map.removeLayer(historicMapLayer);
            }
        }
        toggleMapButton.data('clicks', !clicks);
    });
    
    // Toggle map filters
    $('#filters div label').click(function() {
        var checkboxLabel = $(this);
        if (checkboxLabel.find('input[type=checkbox]').is(':checked')) {
            checkboxLabel.addClass('on');
        } else {
            checkboxLabel.removeClass('on');
        }
    });
    
    // Filter historic map layer.
    $('#map-coverage').change(function () {
        if (historicMapLayer) {
            removeHistoricMapLayer();
        }
        if ('0' == $('#map-coverage').val()) {
            $('#toggle-map-button').hide();
        } else {
            addHistoricMapLayer();
        }
        doFilters();
    });
    
    // Filter item type.
    $('#item-type').change(function () {
        var itemType = $(this);
        if ('Place' == itemType.find(':selected').text()) {
            $('#place-type-div').show({duration: 'fast'});
        } else {
            // Reset and hide the place type select.
            $('input[name=place-type]').removeAttr('checked');
            $('#place-type-div').hide({duration: 'fast'});
        }
        if ('Event' == itemType.find(':selected').text()) {
            $('#event-type-div').show({duration: 'fast'});
        } else {
            // Reset and hide the event type checkboxes.
            $('input[name=event-type]').removeAttr('checked');
            $('#event-type-div').hide({duration: 'fast'});
        }
        doFilters();
    });
    
    // Filter place type.
    $('input[name=place-type]').change(function () {
        // Handle all place types checkbox.
        var placeTypeAll = $('input[name=place-type-all]');
        if ($('input[name=place-type]:checked').length) {
            placeTypeAll.prop('checked', false).parent().removeClass('on');
        } else {
            placeTypeAll.prop('checked', true).parent().addClass('on');
        }
        doFilters();
    });
    
    // Handle the all place types checkbox.
    $('input[name=place-type-all]').change(function () {
        // Uncheck all place types.
        $('input[name=place-type]:checked').prop('checked', false).
            parent().removeClass('on');
        doFilters();
    });
    
    // Filter event type.
    $('input[name=event-type]').change(function () {
        // Handle all event types checkbox.
        var eventTypeAll = $('input[name=event-type-all]');
        if ($('input[name=event-type]:checked').length) {
            eventTypeAll.prop('checked', false).parent().removeClass('on');
        } else {
            eventTypeAll.prop('checked', true).parent().addClass('on');
        }
        doFilters();
    });
    
    // Handle the all event types checkbox.
    $('input[name=event-type-all]').change(function () {
        // Uncheck all event types.
        $('input[name=event-type]:checked').prop('checked', false).
            parent().removeClass('on');
        doFilters();
    });
    
    /*
     * Filter markers.
     * 
     * This must be called on every form change.
     */
    function doFilters() {
        // Prevent concurrent filter requests.
        if (jqXhr) {
            jqXhr.abort()
        }
        
        // Remove the current markers.
        if (geoJsonLayer) {
            map.removeLayer(geoJsonLayer);
        }
        
        var mapCoverage = $('#map-coverage');
        var itemType = $('#item-type');
        var placeTypes = $('input[name=place-type]:checked');
        var eventTypes = $('input[name=event-type]:checked');
        
        // Prepare POST data object for request.
        var postData = {
            placeTypes: [], 
            eventTypes: [], 
        };
        
        // Handle each filter, adding to the POST data object.
        if ('0' != mapCoverage.val()) {
            postData['mapCoverage'] = mapCoverage.val();
        }
        if ('0' != itemType.val()) {
            postData['itemType'] = itemType.val();
        }
        if (placeTypes.length) {
            placeTypes.each(function () {
                postData.placeTypes.push(this.value);
            });
        }
        if (eventTypes.length) {
            eventTypes.each(function () {
                postData.eventTypes.push(this.value);
            });
        }
        
        // Make the POST request, handle the GeoJSON response, and add markers.
        jqXhr = $.post('mall-map/index/filter', postData, function (response) {
            var item = (1 == response.features.length) ? 'item' : 'items';
            $('#marker-count').text(response.features.length + " " + item);
            geoJsonLayer = L.geoJson(response, {
                onEachFeature: function (feature, layer) {
                    layer.bindPopup(
                        '<a href="' + feature.properties.url + '">' + feature.properties.title + '</a><br/>' + 
                        feature.properties.thumbnail
                    ).on('click', function () {
                        map.panTo([feature.geometry.coordinates[1], feature.geometry.coordinates[0]]);
                    });
                }
            });
            geoJsonLayer.addTo(map);
        });
    }
    
    /*
     * Add the historic map layer.
     */
    function addHistoricMapLayer()
    {
        // Get the historic map data
        var getData = {'text': $('#map-coverage').val()};
        $.get('mall-map/index/historic-map-data', getData, function (response) {
            historicMapLayer = L.tileLayer(
                response.url, 
                {tms: true, opacity: 1.00}
            );
            map.addLayer(historicMapLayer);
            $('#toggle-map-button').show();
            
            // Set the map title as the map attribution prefix.
            map.attributionControl.setPrefix(response.title);
        });
    }
    
    /*
     * Remove the historic map layer.
     */
    function removeHistoricMapLayer()
    {
        $('#toggle-map-button').data('clicks', false).hide();
        map.removeLayer(historicMapLayer);
        map.attributionControl.setPrefix('');
    }
    
    /*
     * Revert to default (original) form state.
     */
    function revertFormState()
    {
        if (historicMapLayer) {
            removeHistoricMapLayer();
        }
        
        $('#map-coverage').val('0');
        $('#item-type').val('0');
        
        $('#place-type-div').hide({duration: 'fast'});
        $('input[name=place-type-all]').prop('checked', true).
            parent().addClass('on');
        $('input[name=place-type]:checked').prop('checked', false).
            parent().removeClass('on');
        
        $('#event-type-div').hide({duration: 'fast'});
        $('input[name=event-type-all]').prop('checked', true).
            parent().addClass('on');
        $('input[name=event-type]:checked').prop('checked', false).
            parent().removeClass('on');
        
        doFilters();
    }
    
    /*
     * Retain previous form state.
     * 
     * Acts on the assumption that all browsers will preserve the form state 
     * when navigating back to the map from another page.
     */
    function retainFormState()
    {
        if ('0' != $('#map-coverage').val()) {
            addHistoricMapLayer();
        }
        if ('Place' == $('#item-type').find(':selected').text()) {
            var placeTypes = $('input[name=place-type]:checked');
            if (placeTypes.length) {
                $('input[name=place-type-all]').parent().removeClass('on');
                placeTypes.parent().addClass('on');
            }
            $('#place-type-div').show({duration: 'fast'});
        }
        if ('Event' == $('#item-type').find(':selected').text()) {
            var eventTypes = $('input[name=event-type]:checked');
            if (eventTypes.length) {
                $('input[name=event-type-all]').parent().removeClass('on');
                eventTypes.parent().addClass('on');
            }
            $('#event-type-div').show({duration: 'fast'});
        }
    }
    
    var debugTimestamp; 
    function start() {
        debugTimestamp = new Date().getTime();
    }
    function stop() {
        console.log((new Date().getTime() / 1000) - (debugTimestamp / 1000));
    }
});
