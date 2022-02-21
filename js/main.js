const margin = { top: 8, right: 35, bottom: 8, left: 0 }
const scrollBarAdjusment = 17
const svgWidth = $('#plotting-area').width() - (margin.left + margin.right) - scrollBarAdjusment;
const svgHeight = $('#plotting-area').height() - (margin.top + margin.bottom) - scrollBarAdjusment;

let svg = d3.select('#plotting-area svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .attr('transform', `translate(${margin.left}, ${margin.top})`)

let landscapes = []

const minColor = '#4e8200'
const midColor = '#ffe600'
const maxColor = '#4f3515'
const color = d3.scaleLinear()
    .range([minColor, midColor, maxColor])




d3.select('body').on('keydown', (event, d) => {
    landscapes.forEach(landscape => {
        const vis = landscape
        switch (event.key) {
            case 'ArrowDown':
                vis.currentDepth -= vis.currentDepth > 1 ? 1 : 0
                break
            case 'ArrowUp':
                vis.currentDepth += vis.currentDepth < vis.hierarchy.depth + vis.hierarchy.height ? 1 : 0
        }
        vis.drawTreemap(vis.currentHierarchy, vis.currentDepth)
    })
})

const dataList = [
    { name: 'Table Apple (1kg)', path: 'data/TableApple1kg_ClimateChange.csv' },
]

// const dataList = [
//     { name: 'Chocolate (average consumption mix)', path: 'data/MilkChocolate180g_ClimateChange.csv' },
//     // { name: 'Chocolate (sourced from Ghana)', path: 'data/MilkChocolate180g_GHsourced_ClimateChange.csv' },
//     { name: 'Chocolate (sourced from Indonesia)', path: 'data/MilkChocolate180g_IDsourced_ClimateChange.csv' },
//     { name: "Chocolate (sourced from Cote d'Ivoire)", path: 'data/MilkChocolate180g_CIsourced_ClimateChange.csv' },

// ]

const dataRead = []
dataList.forEach(entry => dataRead.push(d3.csv(entry.path)))

Promise.all(dataRead).then(files => {

    const hierarchies = []

    files.forEach(data => {
        data.forEach(d => {
            d.Amount = Number(d.Amount)
            d.value = d.Amount
        })
        data.columns.push('value')
        hierarchies.push(
            d3.stratify()
                .id(d => d.id)
                .parentId(d => d.parent_id)(data)
                .each(d => d.value = d.data.value)
        )
    })

    const maxTreeValues = []
    hierarchies.forEach((d, i) => {
        maxTreeValues.push(maxTreeValue(d))
    })

    const maxTreeDifference = []
    maxTreeValues.forEach((d, i) => {
        maxTreeDifference.push(d3.max(maxTreeValues) - maxTreeValues[i])
    })

    const adjustedHierarchies = []
    files.forEach((data, i) => {
        if (maxTreeDifference[i] > 0) {
            const improvementEntry = {
                Process: "Improvement relative to the product with the highest impact",
                Amount: 0,
                Unit: "kg CO2 eq",
                id: '-',
                hierarchy_level: 1,
                parent_id: '0',
                Phase: "Relative Improvement",
                Location: "-",
                Process_shorthand: 'Improvement',
                value: maxTreeDifference[i]
            }
            data.push(improvementEntry)
        }
        adjustedHierarchies.push(
            d3.stratify()
                .id(d => d.id)
                .parentId(d => d.parent_id)(data)
                .each(d => d.value = d.data.value)
        )
    })


    function colorCollapse() {
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

    const landscapePosition = d3.scaleBand()
        .domain([...Array(files.length).keys()])
        .range([0, svgWidth])
        .paddingInner(0.35) // edit the inner padding value in [0,1]
        .paddingOuter(0.25) // edit the outer padding value in [0,1]

    adjustedHierarchies.forEach((data, i) => {
        svg.append('g')
            .classed('landscape-container', true)
            .attr('id', `landscape-${i}`)

        landscapes.push(new LandscapeMap(
            `#landscape-${i}`,
            data,
            landscapePosition.bandwidth(),
            svgHeight,
            color,
            d3.max(maxTreeValues),
            d3.max(adjustedHierarchies.map(d => d.height)),
            7
        ))
    })

    d3.selectAll('.landscape-container').attr('transform', (d, i) => `translate(${landscapePosition(i)}, 0)`)

    // color legend code
    const legendWidth = 260
    const colorLegend = d3.select('#info-color')
        .append('svg')
        .attr('width', legendWidth)
        .attr('height', 50)

    const noColors = 9
    const colorPadding = 1
    const legendLinear = d3.legendColor()
        .shapeWidth(legendWidth/(noColors+1) - colorPadding)
        .cells(noColors)
        .orient('horizontal')
        .scale(color)
        .labelOffset(0)
        .shapePadding(colorPadding)
        .ascending(true)
        .labels(d => d.i === 0 || d.i === noColors-1 || d.i === Math.round(noColors/2)-1 ? d.generatedLabels[d.i] : '')
        .title(`Impact (${files[0][0].Unit})`)
        .labelFormat('.02f')

    colorLegend.append('g')
        .classed('color-axis', true)
        .attr('transform', 'translate(0, 3)')
        .call(legendLinear)

    colorLegend.select('.color-axis .legendTitle')
        .attr('transform', 'translate(0, 6)')
        .style('font-family', "'Work Sans', sans-serif")

    const colorBlockCopy = colorLegend.select('.color-axis .legendCells .cell rect')

    const waterGroup = colorLegend.select('.color-axis .legendCells').append('g')
        .attr('transform', `translate(${(Number(colorBlockCopy.attr('width'))+colorPadding)*noColors}, 0)`)

    waterGroup.append('rect')
            .attr('class', colorBlockCopy.attr('class'))
            .attr('width', colorBlockCopy.attr('width'))
            .attr('height',colorBlockCopy.attr('height'))
            .attr('fill', '#237dc2')

    const colorTextCopy = colorLegend.select('.color-axis .legendCells .cell text')

    waterGroup.append('text')
            .attr('class', colorTextCopy.attr('class'))
            .attr('transform', colorTextCopy.attr('transform'))
            .attr('style', colorTextCopy.attr('style'))
            .text('\u25BC')
        
});


// roadmap legend code
const roadmapLegend = d3.select('#info-roadmap')
    .append('svg')
    .attr('width', "260px")
    .attr('height', 34)
const roadmapLegendScale = d3.scaleBand()
    .domain([1, 2, 3])
    .range([0, roadmapLegend.node().getBoundingClientRect().width])
    .paddingInner(0.2)

roadmapLegend.append('circle')
    .attr('cx', roadmapLegendScale(1) + roadmapLegendScale.bandwidth() / 2)
    .attr('cy', 17)
    .attr('r', 15)
    .attr('fill', '#4e8200')

roadmapLegend.append('circle')
    .attr('cx', roadmapLegendScale(2) + roadmapLegendScale.bandwidth() / 2)
    .attr('cy', 17)
    .attr('r', 15)
    .attr('fill', 'white')
    .attr('stroke', '#4e8200')
    .attr('stroke-width', '2')

roadmapLegend.append('circle')
    .attr('cx', roadmapLegendScale(3) + roadmapLegendScale.bandwidth() / 2)
    .attr('cy', 17)
    .attr('r', 15)
    .attr('fill', 'white')
    .attr('stroke', 'black')
    .attr('stroke-width', '2')


const roadmapLegendAxis = d3.axisBottom(roadmapLegendScale)
roadmapLegend.append('g')
    .classed('rmAxis', true)
    .call(roadmapLegendAxis)

roadmapLegend.selectAll('.rmAxis .tick text')
    .attr('color', d => (d === 1) ? 'white' : 'black')

// roadmap legend code end



