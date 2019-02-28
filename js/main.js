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
        hashParams = window.location.search.split('&');
        pageNumber = window.location.hash.substr(1) ? window.location.hash.substr(1).slice(window.location.hash.substr(1).indexOf('-') + 1) : 1;
        address = decodeURI(window.location.search.split('&')[0]); // get street from url params

        if ( window.location.hash.substr(1) ) {
            hashParams.push(window.location.hash.substr(1));
        }

        if ( $('#googleAutocomplete').length ) {
            autocomplete = new google.maps.places.Autocomplete(( // google autocomplete
                document.getElementById('googleAutocomplete')), {
                types: ['geocode'],
                componentRestrictions: {country: "pl"}
            });

            autocomplete.addListener('place_changed', userSelectLocation);
        }

        if ( $('#index-detail').length ) { // check if we in search detail page
            geocoder.geocode({"address":address}, function(results, status) {
                if (status === google.maps.GeocoderStatus.OK) {
                    $('#invalidAddress').attr('hidden', true);
                    drawRadius(results[0].geometry.location);

                    $.ajax({
                        url: 'map-data.json',
                        type: 'get',
                        dataType: 'json',
                        error: function() {
                            console.log('data map-data error');
                        },
                        success: function(locationsData) {
                            for ( var i = 0; i < locationsData.length; i++ ) { // get points inside radius
                                if ( circle.getBounds().contains( new google.maps.LatLng( locationsData[i].location.lat, locationsData[i].location.lng )) ) {
                                    locationsFound.push(locationsData[i].id);
                                }
                            }

                            if ( locationsFound.length > 0 ) {
                                $.ajax({
                                    url: 'product-data.json',
                                    type: 'get',
                                    dataType: 'json',
                                    error: function () {
                                        console.log('data map-data error');
                                    },
                                    success: function (productsData) {
                                        finalProducts = productsData;
                                        hashParams.forEach(function (item, index) {
                                            if ( index === 0 ) return;
                                            if ( item.indexOf('search') >= 0 ) {
                                                searchVal = item.slice(item.indexOf('=') + 1);
                                                $('#search').val(searchVal);
                                            }
                                            $('.filteringWrapper input[value='+ item.slice(item.indexOf('=') + 1) +']').prop('checked', true);
                                        });
                                        filtering();
                                    }
                                })
                            } else {
                                $('#nothingFound').attr('hidden', false);
                                $('#productContainer').attr('hidden', true);
                            }
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
            locationRedirect(urlParams);
        } else { // user write address himself and press enter
            urlParams = $(".pac-container .pac-item:first").text();
            locationRedirect(urlParams);
        }
    }

    function drawRadius(center) { //create circle radius
        circle = new google.maps.Circle({
            center: center,
            radius: $('#index-detail').data('search') ? $('#index-detail').data('search') : 1000
        });
    }

    function locationRedirect(urlParams) {
        if ( !!$('#index-detail').length ) { // just replace current url to street param for reload page functionality
            window.history.pushState({}, '', './index-detail.html?' + urlParams);
            $('#googleAutocomplete').val(urlParams);
        } else {  // make redirect to detail search page if user enter street in main search page
            window.location.href = "./index-detail.html" + "?" + urlParams;
        }
    }
    
    function filtering() {
        var bufferProducts = finalProducts,
            notSearching = true,
            sorting = '',
            filteringValues = [],
            typesFiltering = [],
            slicePos = pageStep * pageNumber,
            paginatedProductArray = [];

        if ( searchVal ) {
            notSearching = false;
            $('.filteringWrapper').addClass('searching');
            bufferProducts = finalProducts;
            bufferProducts = bufferProducts.filter(function (item) {
                if ( item.title.toLocaleLowerCase().indexOf(searchVal) >= 0 || item.searchType.toLocaleLowerCase().indexOf(searchVal) >= 0 ) {
                    return item;
                }
            });
        } else {
            $('.filteringWrapper').removeClass('searching');
            notSearching = true;
        }

        $('.filteringWrapper input').map(function () {
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

        if ( notSearching ) { // check if use search input, if use - this filters not using
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
                if ( sorting === 'minOrder'  ) {
                    bufferProducts.sort(function (a, b) {
                        if (a.minimumOrder < b.minimumOrder) return -1;
                        if (a.minimumOrder > b.minimumOrder) return 1;
                        return 0;
                    });
                } else if ( sorting === 'deliveryCost' )
                    bufferProducts.sort(function (a, b) {
                        if (a.deliveryCost < b.deliveryCost) return -1;
                        if (a.deliveryCost > b.deliveryCost) return 1;
                        return 0;
                    });
            }
        }

        var uniqueUrlParams = urlParams.filter(function(v, i, a) {
              return a.indexOf(v) === i
        });

        if ( uniqueUrlParams.length ) { // add filter parameters to url
            var paramsEncoded = $.param({ filter: uniqueUrlParams }, true),
                paramsDecoded = decodeURIComponent(paramsEncoded);
            window.history.pushState({}, '', address + "&" + paramsDecoded);
        } else {
            window.history.pushState({}, '', address);
        }

        if ( searchVal ) { // add search value to url
            var seachParamsEncoded = $.param({ search: searchVal }, true),
                seachPparamsDecoded = decodeURIComponent(seachParamsEncoded);
            window.history.pushState({}, '', window.location.href + "&" + seachPparamsDecoded);
        }

        if (pageNumber === 1) {
            paginatedProductArray = bufferProducts.slice(0 , slicePos);
        } else {
            paginatedProductArray = bufferProducts.slice( (slicePos - pageStep), slicePos );
            window.history.pushState({}, '', window.location.href + "#page-" + pageNumber);
        }


        $('.productPagination').pagination({
            items: bufferProducts.length,
            currentPage: pageNumber,
            itemsOnPage: $('#index-detail').data('pagestep') ? $('#index-detail').data('pagestep') : 10,
            onPageClick: function (value) {
                pageNumber = value;
                filtering();
            }
        });

        console.log(bufferProducts);
        console.log(paginatedProductArray);
        if (paginatedProductArray.length) {
            $('.productPagination').removeClass('hidden');
            $('#nothingFound').attr('hidden', true);
            $('#productContainer').attr('hidden', false);
            createHtmlFields(paginatedProductArray); // create html and append to DOM
        } else {
            $('.productPagination').addClass('hidden');
            $('#nothingFound').attr('hidden', false);
            $('#productContainer').attr('hidden', true);
        }

    }
    
    function createHtmlFields(bufferProducts) {
        reset();
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
                    "<a href='tel:"+ item.contacts +"'>"+ item.contacts +"</a>" +
                "</div>" +
                "</div>"
        });

        $('#productContainer').append(contentsStr);
    }

    function reset() {
        $('#productContainer').html('');
        contentsStr = '';
        if (circle) circle.setMap(null)
    }

    // Events
    $('#googleAutocomplete').keyup(function (e) { // google autocomplete enter functionality
        if (e.keyCode === 13) {
            userSelectLocation();
        }
    });

    $('#search').keyup(function () {
        searchVal = $('#search').val().toLocaleLowerCase();
        filtering();
    });

    $('.filterGroup  input').on('change', function () {
        urlParams = [];
        filtering();
    });

});