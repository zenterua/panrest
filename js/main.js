jQuery(function ($) {
    "use strict";

    var autocomplete,
        circle,
        geocoder,
        contentsStr = '',
        address,
        finalProducts,
        locationsFound  = [],
        searchVal = '',
        hashParams = [],
        urlParams = [],
        pageNumber = 1,
        pageStep = $('#index-detail').data('pagestep');

    $(window).load(function () {
        geocoder = new google.maps.Geocoder();
        hashParams = window.location.search.split('&'); // array from all url params
        pageNumber = window.location.hash.substr(1) ? window.location.hash.substr(1).slice(window.location.hash.substr(1).indexOf('-') + 1) : 1; //get pagination pagination
        address = decodeURI(window.location.search.split('&')[0]); // get street from url params

        if ( window.location.hash.substr(1) ) { // add to url page param
            hashParams.push(window.location.hash.substr(1));
        }

        if ( $('#googleAutocomplete').length ) { // google autocomplete
            autocomplete = new google.maps.places.Autocomplete((
                document.getElementById('googleAutocomplete')), {
                types: ['geocode'],
                componentRestrictions: {country: "pl"}
            });

            autocomplete.addListener('place_changed', userSelectLocation);
        }

        if ( $('#index-detail').length ) { // check if search detail page
            geocoder.geocode({"address":address}, function(results, status) {
                if (status === google.maps.GeocoderStatus.OK) {
                    var streetLocation = results[0].geometry.location,
                        locationLatLngArray = []; // this array for google map calculation distance
                    $('#invalidAddress').attr('hidden', true);
                    drawRadius(streetLocation); // draw radius

                    $.ajax({ // get all id restoraunt
                        url: 'map-data.json',
                        type: 'get',
                        dataType: 'json',
                        error: function() {
                            console.log('data map-data error');
                        },
                        success: function(locationsData) {
                            for ( var i = 0; i < locationsData.length; i++ ) { // get points inside radius
                                if ( circle.getBounds().contains( new google.maps.LatLng( locationsData[i].location.lat, locationsData[i].location.lng )) ) {
                                    locationsFound.push(locationsData[i]); // create array with points inside radius
                                    locationLatLngArray.push(locationsData[i].location); // create array with longitude and latitude for calculating distance
                                }
                            }

                            if ( locationsFound.length === 0 ) { // if nothing found, show errors messages
                                $('#nothingFound').attr('hidden', false);
                                $('#productContainer').attr('hidden', true);
                                return false;
                            }

                            var service = new google.maps.DistanceMatrixService;
                            service.getDistanceMatrix({ // google map distance
                                origins: [streetLocation],
                                destinations: locationLatLngArray,
                                travelMode: 'DRIVING',
                                unitSystem: google.maps.UnitSystem.METRIC,
                                avoidHighways: false,
                                avoidTolls: false
                            }, function(response, status) {
                                if (status !== 'OK') {
                                    console.log('Error was: ' + status);
                                } else {
                                    locationsFound.map(function (item, index) { // add distance to each array id from first ajax
                                        item.distance = response.rows[0].elements[index].distance.value;
                                    });
                                    $.ajax({
                                        url: 'product-data.json',
                                        type: 'get',
                                        dataType: 'json',
                                        error: function () {
                                            console.log('data map-data error');
                                        },
                                        success: function (productsData) {
                                            finalProducts = productsData;
                                            finalProducts.forEach(function (item) {
                                                Object.keys(item).forEach(function (key) { // turn on filter if found match products and filter input value
                                                    if ( $('.filterGroup.types input[value="' + key + '"]').length ) {
                                                        $('.filterGroup.types input[value="' + key + '"]').closest('label').addClass('available');
                                                    }
                                                });

                                            });
                                            hashParams.forEach(function (item, index) {
                                                if ( index === 0 ) return;
                                                if ( item.indexOf('search') >= 0 ) { // try find url search parameter
                                                    searchVal = item.slice(item.indexOf('=') + 1);
                                                    $('#search').val(searchVal);
                                                }
                                                $('.filteringWrapper input[value='+ item.slice(item.indexOf('=') + 1) +']').prop('checked', true); // check all filter from url parameters
                                            });
                                            filtering(); // start filtering
                                        }
                                    });
                                }
                            });
                        }
                    })
                } else { // show errors message if user set invalid streets on google autocomplete
                    $('#nothingFound').attr('hidden', true);
                    $('#productContainer').attr('hidden', true);
                    $('#invalidAddress').attr('hidden', false)
                }
            });
        }
    });

    function userSelectLocation() {
        var urlParams = '';
        if ( autocomplete.getPlace().formatted_address ) {   // user select address from autocomplete
            urlParams = autocomplete.getPlace().formatted_address;
            window.location.href = "./index-detail.html" + "?" + urlParams;
        } else { // user write address himself and press enter
            urlParams = $(".pac-container .pac-item:first").text();
            window.location.href = "./index-detail.html" + "?" + urlParams;
        }
    }

    function drawRadius(center) { //create circle radius
        circle = new google.maps.Circle({
            center: center,
            radius: $('#index-detail').data('search') ? $('#index-detail').data('search') : 1000
        });
    }
    
    function filtering() {
        if ( !locationsFound.length ) return false; // if no location found - stop filtering

        var bufferProducts = finalProducts,
            notSearching = true,
            sorting = '',
            filteringValues = [],
            typesFiltering = [],
            slicePos = pageStep * pageNumber,
            paginatedProductArray = [],
            uniqueUrlParams = [];

        if ( searchVal ) { // if we use searching input
            pageNumber = 1;
            notSearching = false; // disable other filtering and sorting
            $('.filteringWrapper').addClass('searching');
            bufferProducts = finalProducts; // searching from full location array, not after filtering, or sorting
            bufferProducts = bufferProducts.filter(function (item) {
                if ( item.title.toLocaleLowerCase().indexOf(searchVal) >= 0 || item.searchType.toLocaleLowerCase().indexOf(searchVal) >= 0 ) {
                    return item;
                }
            });
        } else {
            $('.filteringWrapper').removeClass('searching');
            notSearching = true;
        }

        $('.filteringWrapper input').map(function () { // check filtering inputs
            if ( $(this).is(':checked') ) {
                if ( $(this).closest('.filterGroup').hasClass('sorting') ) {
                    sorting = $(this).val();
                    urlParams.push($(this).val());
                }

                if ( $(this).closest('.filterGroup').hasClass('filtering') ) {
                    filteringValues.push($(this).val());
                    urlParams.push($(this).val());
                }

                if ( $(this).closest('.filterGroup').hasClass('types') ) {
                    typesFiltering.push($(this).val());
                    urlParams.push($(this).val());
                }
            }
        });

        if ( notSearching ) { // if user search input then this filters not using
            if ( filteringValues.length ) { // filtering section
                filteringValues.forEach(function (category) {
                    bufferProducts = bufferProducts.filter(function (item) {
                        if ( item[category] ) {
                            return item;
                        }
                    });
                });
            }

            if ( typesFiltering.length ) { // types filtering section
                typesFiltering.forEach(function (category) {
                    bufferProducts = bufferProducts.filter(function (item) {
                        if ( item[category] ) {
                            return item;
                        }
                    });
                });
            }

            if ( sorting ) { // sorting section
                if ( sorting === 'minOrder'  ) { // sorting if we select min order
                    bufferProducts.sort(function (a, b) {
                        if (a.minimumOrder < b.minimumOrder) return -1;
                        if (a.minimumOrder > b.minimumOrder) return 1;
                        return 0;
                    });
                } else if ( sorting === 'deliveryCost' ) { // sorting if we select delivery cost
                    bufferProducts.sort(function (a, b) {
                        if (a.deliveryCost < b.deliveryCost) return -1;
                        if (a.deliveryCost > b.deliveryCost) return 1;
                        return 0;
                    });
                } else { // and if we select sorting distance between address and all points inside radius
                    bufferProducts.sort(function (a, b) {
                        if (a.distance < b.distance) return -1;
                        if (a.distance > b.distance) return 1;
                        return 0;
                    });
                }

            }
        }

        uniqueUrlParams = urlParams.filter(function(v, i, a) { // here remove duplicate filters params
              return a.indexOf(v) === i
        });

        if ( uniqueUrlParams.length ) { // add filter parameters to url
            var paramsEncoded = $.param({ filter: uniqueUrlParams }, true),
                paramsDecoded = decodeURIComponent(paramsEncoded);
            window.history.pushState({}, '', address + "&" + paramsDecoded); // get standart url with address and add parameters
        } else {
            window.history.pushState({}, '', address); // if nothing found just set to url standart url with address
        }

        if ( searchVal ) { // add search value to url
            var seachParamsEncoded = $.param({ search: searchVal }, true),
                seachPparamsDecoded = decodeURIComponent(seachParamsEncoded);
            window.history.pushState({}, '', window.location.href + "&" + seachPparamsDecoded);
        }

        if (pageNumber === 1) { // here we slice number of content from product array
            paginatedProductArray = bufferProducts.slice(0 , slicePos);
        } else {
            paginatedProductArray = bufferProducts.slice( (slicePos - pageStep), slicePos );
            window.history.pushState({}, '', window.location.href + "#page-" + pageNumber);
        }

        $('.productPagination').pagination({ // init jquery pagination lib // http://flaviusmatis.github.com/simplePagination.js/
            items: bufferProducts.length,
            currentPage: pageNumber,
            itemsOnPage: $('#index-detail').data('pagestep') ? $('#index-detail').data('pagestep') : 10,
            onPageClick: function (value) {
                pageNumber = value;
                filtering();
            }
        });

        if (bufferProducts.length) { // check if after filtering we has some points
            $('.productPagination').removeClass('hidden');
            $('#nothingFound').attr('hidden', true);
            $('#productContainer').attr('hidden', false);
            // if pagination slice array length same like all product array - hide pagination
            bufferProducts.length === paginatedProductArray.length ? $('.productPagination').attr('hidden', true) : $('.productPagination').attr('hidden', false);
            createHtmlFields(paginatedProductArray); // create html and append to DOM
        } else { // if nothing found show error messages
            $('.productPagination').addClass('hidden');
            $('#nothingFound').attr('hidden', false);
            $('#productContainer').attr('hidden', true);
        }

    }
    
    function createHtmlFields(bufferProducts) { // created html after filtering, sorting etc.
        $('#productContainer').html('');
        contentsStr = '';
        if (circle) circle.setMap(null);

        bufferProducts.forEach(function (item) {
            contentsStr += "<div class='productItem'>" +
                "<div class='imgWrapper'>" +
                    "<img src="+ item.img +" alt='product'>" +
                "</div>" +
                "<div class='productInfo'>" +
                    "<h2 class='as'><span>Title: </span>"+ item.title + "</h2>" +
                    "<p><span>Street: </span>"+ item.street +"</p>" +
                    "<p><span>Description: </span>"+ item.description  +"</p>" +
                    "<p><span>Minimum order: </span>"+ item.minimumOrder +"</p>" +
                    "<p><span>Delivery Cost: </span>"+ item.deliveryCost +"</p>" +
                    "<p><span>Distance: </span>"+ (item.distance / 1000).toFixed(1) + " km" +"</p>" +
                    "<a href='tel:"+ item.contacts +"'>"+ item.contacts +"</a>" +
                "</div>" +
                "</div>"
        });

        $('#productContainer').append(contentsStr);
    }

    // Events
    $('#googleAutocomplete').keyup(function (e) { // google autocomplete enter functionality
        if (e.keyCode === 13) {
            userSelectLocation();
        }
    });

    $('#search').keyup(function () { // start filter after beginning write some text
        searchVal = $('#search').val().toLocaleLowerCase();
        filtering();
    });

    $('.filterGroup  input').on('change', function () { // start filtering after change any filter input
        urlParams = [];
        filtering();
    });

});