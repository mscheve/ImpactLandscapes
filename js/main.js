// specifying some required global and setting variables
let landscapes
let landscapeGlobalValues
const paddingBetweenLandscapes = 0.3 // decrease leads to bigger landscape(s) but potential annotation collisions
const paddingOuterLandscapes = 0.25 // decrease leads to bigger landscape(s) but potential annotation collisions
const showTutorialOnBootUp = true


// specifying the colorscale
let minColor = '#4e8200' //green (color blind safe: #018571)
let midColor = '#FFE705' //yellow (color blind safe: #f5f5f5)
let maxColor = '#67451B' //brown (color blind safe: #a6611a)
const color = d3.scaleLinear().range([minColor, midColor, maxColor])


// specifying the svg canvas dimensions dynamically based on browser window size
const margin = { top: 8, right: 35, bottom: 8, left: 0 }
const scrollBarAdjusment = 17
const svgWidth = $('#plotting-area').width() - (margin.left + margin.right) - scrollBarAdjusment;
const svgHeight = $('#plotting-area').height() - (margin.top + margin.bottom) - scrollBarAdjusment;

let svg = d3.select('#plotting-area svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .attr('transform', `translate(${margin.left}, ${margin.top})`)


// start initial rendering of the impact landscapes
const dataRead = []
const indexDataList = 1 // the case that will be rendered first after loading
const indexDataSets = [0, 2] // the datasets that will be rendered first after loading

dataList[indexDataList].datasets.forEach((entry, i) => { // extracting the initial data to be rendered
    if (indexDataSets.includes(i)) {
        dataRead.push(d3.csv(entry.path))
    }
    else { null }
})

redrawCanvas(dataRead)
// end initial rendering data


// start of case and dataset selection menu's in the setting window
let caseSelect = d3.select('#case-select').node(),
    option,
    i = 0,
    il = dataList.length;

for (; i < il; i += 1) {
    option = document.createElement('option');
    option.setAttribute('value', i);
    option.appendChild(document.createTextNode(dataList[i].caseName));
    caseSelect.appendChild(option);
}

function populateDatasets() { // dynamically updating the html selection elements depending on the available cases and datasets
    const sets = dataList[$("#case-select").val()].datasets
    d3.selectAll('#data-select option').remove()
    let dataSelect = d3.select('#data-select').node()
    option,
        i = 0,
        il = sets.length;

    for (; i < il; i += 1) {
        option = document.createElement('option');
        option.setAttribute('value', sets[i].path);
        option.appendChild(document.createTextNode(sets[i].name));
        dataSelect.appendChild(option);
    }
}

populateDatasets() // updating the setting menu's with the available data

$('#case-select').on('change', d => { // event listener that scans for case setting changes
    populateDatasets()
})

$('#apply-settings').on('click', d => { // event listener that applies the settings
    const dataRead = []
    $('#data-select').val().forEach(path => dataRead.push(d3.csv(path)))
    redrawCanvas(dataRead)
})
// end of case and dataset selection menu's in the setting window

// start of impact landscapes javascript orchestration
// this is the main function that orchestrates the rendering of the legend, impact landscapes, and other layout features
function redrawCanvas(sets) {
    Promise.all(sets).then(files => {

        d3.select("#plotting-area svg").selectAll('*').remove() // cleaning the svg canvas

        const hierarchies = []

        // start data type conversions and hierarchy creation
        files.sort((a, b) => d3.max(b.map(d => d.Amount)) - d3.max(a.map(d => d.Amount)))
        files.forEach(data => {
            data.forEach(d => {
                d.Amount = Number(d.Amount)
                d.value = d.Amount
            })
            data.columns.push('value')
            hierarchies.push(
                d3.stratify() // d3 stratification to turn the adjacency list into a hierarchical javascript object
                    .id(d => d.id)
                    .parentId(d => d.parent_id)(data)
                    .each(d => d.value = d.data.value)
            )
        })
        // end data type conversions and hierarchy creation

        // start dynamic colormap data calibration
        const maxTreeValues = []
        hierarchies.forEach((d, i) => {
            maxTreeValues.push(maxTreeValue(d))
        })

        function colorCollapse() { // extracts the min, mean, and max across all visualized datasets
            const tempColorMaxs = []
            hierarchies.forEach(d => {
                tempColorMaxs.push(leaveValues(d))
            })
            let min = [],
                max = [],
                mid = []

            tempColorMaxs.forEach(d => {
                min.push(d[0])
                max.push(d[1])
                mid.push(d[2])
            })

            min = d3.min(min)
            max = d3.max(max)
            mid = d3.mean(mid)
            return [min, max, mid]
        }

        colorMaxs = colorCollapse()

        color.domain([colorMaxs[0], colorMaxs[2], colorMaxs[1]])
        // end dynamic colormap data calibration


        // start creation and dynamic horizontal placement of impact landscape(s)
        const landscapePosition = d3.scaleBand()
            .domain([...Array(files.length).keys()])
            .range([0, svgWidth])
            .paddingInner(paddingBetweenLandscapes)
            .paddingOuter(paddingOuterLandscapes)

        // resetting global values
        landscapes = []
        landscapeGlobalValues = []

        hierarchies.forEach((data, i) => {
            svg.append('g')
                .classed('landscape-container', true)
                .attr('id', `landscape-${i}`)

            landscapes.push(new ImpactLandscape( // here the actual impact landscapes are generated based on the LandscapMap class declared in impact_landscape.js
                `#landscape-${i}`, // the identifier that will be assigned to the html DOM elements
                data,
                files[i],
                landscapePosition.bandwidth(),
                svgHeight,
                color,
                d3.max(maxTreeValues),
                d3.max(hierarchies.map(d => d.height))
            ))
        })

        d3.selectAll('.landscape-container')
            .attr('transform', (d, i) => `translate(${landscapePosition(i)}, 0)`)
        // end creation and dynamic horizontal placement of impact landscape(s)


        // start colormap legend javascript implementation    
        d3.select('.color-axis-container').remove()

        const legendWidth = 260
        const colorLegend = d3.select('#info-color')
            .append('svg')
            .classed('color-axis-container', true)
            .attr('width', legendWidth)
            .attr('height', 65)

        let mean, checked = false
        const noColors = 100 // resolution of the colormap legend (100 steps)
        const colorPadding = -1

        const legendLinear = d3.legendColor()
            .shapeWidth(legendWidth / (noColors) - colorPadding)
            .cells(noColors)
            .orient('horizontal')
            .scale(color)
            .labelOffset(0)
            .shapePadding(colorPadding)
            .ascending(false)
            .labels(d => { // only showing labels for the min, mean, and max values
                mean = findClosest(d.generatedLabels, colorMaxs[2])
                if ((d.i === 0 || d.i === noColors - 1 || d.generatedLabels[d.i] === mean)) {
                    if (d.generatedLabels[d.i] === mean & checked == false) {
                        checked = true
                        return d.generatedLabels[d.i]
                    }
                    else if (d.generatedLabels[d.i] != mean) {
                        return d.generatedLabels[d.i]
                    }
                }
                else {
                    return ''
                }
            })
            .title(`Impact (${files[0][0].Unit})`)
            .labelFormat('.09f') // formating the labels to x.xx
            .labelAlign('start')

        // several operations to fix the custom colormap legend appearance
        colorLegend.append('g')
            .classed('color-axis', true)
            .attr('transform', 'translate(0, 3)')
            .call(legendLinear)

        colorLegend.select('.color-axis .legendTitle')
            .attr('transform', 'translate(0, 6)')
            .style('font-family', "'Work Sans', sans-serif")

        colorLegend.selectAll('.label')
            .each((d, i, element) => {
                if (i === noColors - 1) {
                    return d3.select(element[i]).attr('style', 'text-anchor: end;')
                }
                else {
                    if (d === mean) {
                        return d3.select(element[i]).attr('style', 'text-anchor: middle;')
                    }
                    else {
                        return null
                    }
                }
            })

        colorLegend.selectAll('.label')
            .text(d => d ? d3.format('.02f')(d) : null)

        colorLegend.selectAll('.label')
            .filter(d => { if (d) { return true } })
            .append('svg:tspan')
            .text((d, i, element) => { // appending the "min", "mean", and "max" strings to the labels
                if (i === 0) { return '(min)' }
                else {
                    if (i === 2) { return '(max)' }
                    else { return '(mean)' }
                }
            })
            .attr('dy', 12)
            .attr('x', 0)
            .style('font-size', 9)
        // end colormap legend javascript implementation 


        // start size legend javascript implementation
        function drawSizeLegend() {
            let sizeMap = {}

            d3.selectAll('path.cell')._groups[0].forEach(d => {
                sizeMap[d.__data__.value] = d3.polygonArea(d.__data__.polygon)
            })

            let maxAreaValue = sizeMap[d3.max(Object.keys(sizeMap))]
            let maxImpactValue = d3.max(Object.keys(sizeMap))
            let impactToArea = maxAreaValue / maxImpactValue // calculating the size to impact ratio that was resulted from the Voronoi tessellation
         
            d3.select('.size-axis-container').remove()

            // specifying 3 set circles which areas are aligned with the voronoi regions in terms of impact size
            let smallArea = 1000,
                mediumArea = 4000,
                largeArea = 12000
            let smallVal = smallArea / impactToArea,
                mediumVal = mediumArea / impactToArea,
                largeVal = largeArea / impactToArea

            const sizeLegend = d3.select('#info-size')
                .append('svg')
                .classed('size-axis-container', true)
                .attr('width', legendWidth)
                .attr('height', ((35000 ** 0.5 / Math.PI) * 2) + 25)

            const legendArea = d3.legendSize()
                .scale(d3.scaleOrdinal()
                    .range([
                        (smallArea / Math.PI) ** 0.5,
                        (mediumArea / Math.PI) ** 0.5,
                        (largeArea / Math.PI) ** 0.5])
                    .domain([
                        d3.format('.02f')(smallVal),
                        d3.format('.02f')(mediumVal),
                        d3.format('.02f')(largeVal)]))
                .orient('horizontal')
                .shape('circle') // rectangles would look better but do not match the human perception properties that are associated with polygon area size
                .shapePadding(36.5)
                .title(`Impact (${files[0][0].Unit})`)

            // several operations to fix the custom size legend appearance    
            sizeLegend.append('g')
                .classed('size-axis', true)
                .attr('transform', `translate(0, 17.5)`)
                .call(legendArea)

            sizeLegend.select('.size-axis .legendTitle')
                .attr('transform', 'translate(0, -6)')
                .style('font-family', "'Work Sans', sans-serif")

            sizeLegend.selectAll('circle')
                .attr('fill', d => lineGenerator(
                    d3.select('defs'),
                    color(d3.max([d3.min([d, colorMaxs[1]]), colorMaxs[0]])),
                    d3.color(color(d3.max([d3.min([d, colorMaxs[1]]), colorMaxs[0]]))).darker(0.4)
                ))
        }

        drawSizeLegend() // initialize the size legend
        d3.select('.landscape-container')
            .on('click', function () { drawSizeLegend() }) // redraw the size legend when interaction takes place in the impact landscapes
        // end size legend javascript implementation


        // start dynamically updating legend text
        $(document).ready(function () {
            d3.select('#legendNIndicator').html(files.length)

            switch (files[0][0].Unit) {
                // atm only implemented for the climate change case however more indicators are
                // already specified in indicators.js (expand to own requirement)
                case 'kg CO2 eq':
                    let title = indicators['kg CO2 eq'].description
                    d3.select('#legendEIndicator').html(indicators['kg CO2 eq'].indicator)
                    $('#legendEIndicatorTT').tooltip('dispose').tooltip({ title: title })
            }
        })
        // end dynamically updating legend text
    })

};


// start of tutorial javascript implementation
// adapted from https://codepen.io/Ayn_/pen/vmVKZV
$(document).ready(function () {
    prep_modal();
});

var tutorialModal = new bootstrap.Modal(document.getElementById('tutorialModal'), {})

function prep_modal() {
    $(".modal").each(function () {

        var element = this;
        var pages = $(this).find('.modal-split');

        if (pages.length != 0) {
            pages.hide();
            pages.eq(0).show();

            // creating the "back" button for the tutorial
            var b_button = document.createElement("button");
            b_button.setAttribute("type", "button");
            b_button.setAttribute("class", "btn btn-primary");
            b_button.setAttribute("style", `display: none; background-color: ${minColor}; border-color: ${minColor};`);
            b_button.innerHTML = "Back";

            // creating the "next" button for the tutorial
            var n_button = document.createElement("button");
            n_button.setAttribute("type", "button");
            n_button.setAttribute("class", "btn btn-primary");
            n_button.setAttribute("style", `background-color: ${minColor}; border-color: ${minColor};`);
            n_button.innerHTML = "Next";

            $(this).find('.modal-footer').append(b_button).append(n_button);

            // orchastring the different pages of the tutorial
            var page_track = 0;

            $(n_button).click(function () {

                this.blur();

                if (page_track == 0) {
                    $(b_button).show();
                }
                if (page_track == pages.length - 2) {
                    $(n_button).text("Done");
                }
                if (page_track == pages.length - 1) {
                    tutorialModal.hide();
                }
                if (page_track < pages.length - 1) {
                    page_track++;
                    pages.hide();
                    pages.eq(page_track).show();
                }
            });

            $(b_button).click(function () {

                if (page_track == 1) {
                    $(b_button).hide();
                }
                if (page_track == pages.length - 1) {
                    $(n_button).text("Next");
                }
                if (page_track > 0) {
                    page_track--;

                    pages.hide();
                    pages.eq(page_track).show();
                }
            });
        }
    });
}

if (showTutorialOnBootUp) {
    tutorialModal.toggle()
}
// end of tutorial javascript implementation

// bug fix for legend tooltips 
$(document).ready(function () {
    $('[data-toggle="tooltip"]').tooltip({ 'data-placement': 'right' });
});

d3.selectAll('.btn-primary')
    .style('background-color', minColor)
    .style('border-color', minColor)

d3.selectAll('.glossary')
    .style('color', minColor)
