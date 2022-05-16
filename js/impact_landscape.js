/*
This class implements the core of impact landscapes through object-oriented programming 
as suggested by: https://elliotbentley.com/blog/a-better-way-to-structure-d3-code-es6-version/

It is responsible for rendering the interactive Voronoi treemaps, creating the title/navigation 
menu (roadmap), orchestrating the annotation creation and placement, and implementing the hover
information window.

Note1: make sure that you manually declare the landscape and landscapeGlobalValues variables 
(undefined) outside the scope of the ImpactLandscape when using the class seperately.

Note2: make sure that you manually import the functions declared in helpers.js when using the 
class seperately.
*/
class ImpactLandscape {
    constructor(_parentElement, _hierarchy, _data, _width, _height, _color, _absoluteMax, _maxHeight) {
        this.svgWidth = _width
        this.svgHeight = _height
        this.parentElement = _parentElement // the html DOM element to which the impact landscape will be appended
        this.hierarchy = _hierarchy // the contribution tree in a hierarchical data structure
        this.data = _data // the raw contribution tree in its flat (adjacency-list) representation
        this.color = _color // the d3 colormap object
        this.absoluteMax = _absoluteMax // the maximum impact across all evaluated contribution trees
        this.maxHeight = _maxHeight // the maximum height across all evaluated contribution trees
        this.initVis()
    }


    initVis() {
        // this function is called by the constructor function when a new ImpactLandscape object is created
        // it defines the necesarry variables and calls the necesarry function that will draw the impact landscapes

        const vis = this
        vis.initialRun = true

        // specifying some layout related dimensions
        vis.menuHeight = 150
        vis.annotationHeight = 75 // the maximum height of the annotations
        vis.annotationWidth = 150 // the maximum width of the annotaitons

        // specifying some treemap related dimensions
        vis.treemapRadius = (Math.min(((vis.svgWidth) / 2), ((vis.svgHeight) / 2) - vis.menuHeight)) // the variable radius of the impact landscape for difference visualization
        vis.treemapCRadius = vis.treemapRadius // the original contstant radius of the impact landscape for layout purposes
        vis.treemapArea = (vis.treemapRadius ** 2) * Math.PI // the initial area of the impact landscape based on its initial radius
        vis.treemapCenter = [vis.svgWidth / 2, ((vis.svgHeight + vis.menuHeight) / 2)] // the center of the impact landscape

        // extracting and defining the colors from the input colormap
        vis.minColor = vis.color.range()[0]
        vis.midColor = vis.color.range()[1]
        vis.maxColor = vis.color.range()[2]
        vis.outerColor = d3.color(vis.color.range()[0]).darker(3.5) // the color used in borders of polygons

        // specifying some dimensions related to the drawing of borders 
        vis.minBorderWidth = 1
        vis.maxBorderWidth = 6
        vis.noLevelsDisplayed = 2 // the number of differentiable hierarchy levels that should be visualized
        vis.stroke_delta = (vis.maxBorderWidth - vis.minBorderWidth) * 1.0 / vis.noLevelsDisplayed // the difference in border width between different hierarchy levels

        // specifying some dimensions related to the drawing of field labels
        vis.minLabelSize = 12
        vis.maxLabelSize = 12 // equal to minLabelSize for constant size

        // specifying some annotation related variables 
        vis.annotationNumber = 5 // the maximum number of automatically drawn annotations
        vis.markedIds = []; // a temporary storage for manually added annotations

        // initializing some supporting variables
        vis.currentDepth = 1 // the current hierarchy level up to which processes are revealed (initially the root (0) + 1)
        vis.currentHierarchy = vis.hierarchy // the current focal hierachy (initially the root)
        landscapeGlobalValues.push(vis.hierarchy.value)


        // start of inital voronoi treemap generator declarations
        vis._voronoiTreemap = d3.voronoiTreemap()
            .convergenceRatio([0.01]) // sets the convergence ratio, which stops computation when (cell area errors / (clip-ping polygon area) <= convergenceRatio
            .maxIterationCount([500]) // sets the maximum allowed number of iterations, which stops computation when it is reached, even if the convergenceRatio is not reached
            .minWeightRatio([0.01]); // sets the minimum weight ratio, which allows to compute the minimum allowed weight (= maxWeight * minWeightRatio)

        vis.circlingPolygon = computeCirclingPolygon(vis.treemapRadius) // computing the clipping polygon (the boundary shape of the treemap)
        // end of initial voronoi treemap generator declarations


        // start of additional scale definitions and calibrations
        vis.fontScale = d3.scaleLinear()
            .range([vis.minLabelSize, vis.maxLabelSize])
            .clamp(true);

        vis.menuBands = d3.scaleBand()
            .range([0, vis.treemapRadius * 2])
            .paddingInner(0.2)

        vis.menuBandWidth = vis.menuBands.domain([...Array(vis.maxHeight + 1).keys()]).bandwidth()

        vis.menuBands.domain([...Array(vis.maxHeight + 1).keys()])
        // end of additional scale definitions and calibrations


        vis.initLayout(); // creating the html DOM elements that are necesarry to structure the drawing of the impact landscape
        vis.drawTreemap(vis.hierarchy, vis.currentDepth); // drawing the impact landscape
    }

    initLayout() {
        // this function creates and structures the different html DOM elements (containers) 
        // in which all other impact landscape related elements will be situated

        // initializing some variables
        const vis = this
        const treemapRadius = vis.treemapRadius
        const treemapCenter = vis.treemapCenter

        // retrieving the parent html DOM element
        vis.svg = d3.select(vis.parentElement)

        // the overarching container in which all other containers will be located
        vis.treemapContainer = vis.svg.append("g")
            .classed("treemap-container", true)
            .attr("transform", "translate(" + treemapCenter + ")");

        // an invisble container for dummy polygons that are used for calculation purposes
        vis.dummyPaths = vis.treemapContainer.append('g')
            .classed('dummy-container', true)


        // start of supporting container declaration and positioning    
        const containerList = [
            'difference-container', // the container housing the difference indicators
            'cell-container', // the container housing the polygons / voronoi regions (i.e. fields)
            'label-container', // the container housing the labels of the fields
            'annotation-container', // the container housing the annotations
            'menu-container', // the container housing the title/navigation area (i.e. roadmap)
            'hover-container', // the container housing the hover information elements
        ]

        containerList.forEach(d => {
            vis.treemapContainer.append('g')
                .classed(d, true)
                .attr("transform", "translate(" + [-treemapRadius, -treemapRadius] + ")")
        })

        // declaring the hover information window generator
        vis.tooltip = vis.drawTooltip()
            .container(vis.treemapContainer.select('.hover-container'))
            .absoluteMax(vis.absoluteMax)

        vis.treemapContainer.select('.menu-container')
            .attr('transform', `translate(${[-treemapRadius, -treemapCenter[1] + vis.menuHeight]})`)

        vis.textureContainer = vis.treemapContainer.select('.cell-container')
            .append('g')
            .classed('texture-container', true)
        // end of supporting container declaration and positioning


        // drawing the ground shape that indicates an impact difference in multi product system use-cases
        vis.treemapContainer.select('.difference-container')
            .append("path")
            .classed('ground-shape', true)
            .attr('id', 'differenceCirc')
            .attr("d", "M" + vis.circlingPolygon.join(",") + "Z")
            .style('stroke-width', 0.25)
            .style('stroke', vis.outerColor)
            .style('fill', 'white')
            .style('stroke-dasharray', '4')
    }

    drawTreemap(hierarchy, levelI, sync) {
        // this function is responsible for drawing the impact landscape and all of its components
        // like the roadmap, hover information window, annotations, labels, etc.


        // initializing some variables
        const vis = this
        const t = d3.transition().duration(vis.initialRun ? 0 : 500) // the transition animation
        const flattenedHierarchy = flattenHierarchy(hierarchy)
        vis.fontScale.domain([leaveValues(hierarchy)[0], leaveValues(hierarchy)[1]])
        vis.absoluteMax = d3.max(landscapeGlobalValues) // calibrating the maximum impact value currently on display


        // start of impact landscape size recalculation
        const newArea = (hierarchy.value / vis.absoluteMax) * vis.treemapArea
        const newRadius = (newArea / Math.PI) ** 0.5

        vis.treemapRadius = newRadius // updating the current impact landscape variable radius

        // repositioning the impact landscape based on its new size
        const radiusDelta = vis.treemapCRadius - newRadius // 0 for center allignment of decreased impact landscapes
        vis.treemapContainer.select('.cell-container')
            .attr('transform', "translate(" + [-vis.treemapRadius, -vis.treemapRadius + radiusDelta] + ")")
        vis.treemapContainer.select('.hover-container')
            .attr('transform', "translate(" + [-vis.treemapRadius, -vis.treemapRadius + radiusDelta] + ")")
        vis.treemapContainer.select('.label-container')
            .attr('transform', "translate(" + [-vis.treemapRadius, -vis.treemapRadius + radiusDelta] + ")")
        vis.treemapContainer.select('.annotation-container')
            .attr('transform', "translate(" + [-vis.treemapRadius, -vis.treemapRadius + radiusDelta] + ")")

        vis.circlingPolygon = computeCirclingPolygon(vis.treemapRadius); // creating a new clipping polygon
        // end of impact landscape size recalculation


        // start to ensure that interaction is legal
        if (vis.currentDepth <= hierarchy.depth) { // making sure the user cannot zoom out further than the focal process
            vis.currentDepth = hierarchy.children ? hierarchy.depth + 1 : hierarchy.depth
            levelI = vis.currentDepth
        }

        if (vis.currentDepth > hierarchy.depth + hierarchy.height) { // making sure the user cannot zoom in further than the maximum hierarchy depth
            vis.currentDepth = hierarchy.depth
        }

        if ((hierarchy.id != vis.currentHierarchy.id) || vis.initialRun || sync) {
            vis._voronoiTreemap.clip(vis.circlingPolygon)(hierarchy); // perform the weighted PW Voronoi Tessellation
        }
        // end to ensure that interaction is legal


        // start drawing polygons / voronoi regions (i.e. fields)
        const cellContainer = vis.treemapContainer.select('.cell-container')

        const cells = cellContainer.selectAll(".cell")
            .data(flattenedHierarchy, d => d.id)

        cells.exit().remove()

        cells.raise() //important to fix the html element order when redrawing landscapes (hiding hidden layers)

        cells.enter().append("path")
            .classed("cell", true)
            .attr('id', d => `cell-${d.id}`)
            .style("fill-opacity", function (d) { // making fields transparent that are beyond the zoom scope (hidden layers)
                if ((d.depth === levelI) || (!(d.children) && (d.depth <= levelI))) { return 1 }
                else { return 0 }
            })
            .style("fill", d => { // painting the lines on fields to resemble aerial landscapes
                if (d.depth === 0) { return vis.outerColor }
                else { return lineGenerator(vis.textureContainer, vis.color(d.data.Amount), d3.color(vis.color(d.data.Amount)).darker(0.4)) }
            })
            .style('stroke-linejoin', 'round')
            .merge(cells)
            .transition(t)
            .style('stroke', function (d) { // specified twice to fix animation behavior
                if ((d.depth === levelI) || (d.depth <= levelI)) { return d3.color(vis.outerColor) }
                else { return 'transparent' }
            })
            .style("fill-opacity", function (d) { // specified twice to fix animation behavior
                if ((d.depth === levelI) || (!(d.children) && (d.depth <= levelI))) { return 1 }
                else { return 0 }
            })
            .attr("d", function (d) { // setting the shape of polygon (field) to its voronoi region
                return "M" + d.polygon.join(",") + "z"; y
            })
            .style('stroke-width', function (d) { // determining the border width of a field depending on its hierarchy level
                const substract = d.depth === hierarchy.depth + 1 ? 1 : 0
                return Math.max(vis.maxBorderWidth - vis.stroke_delta * (d.depth - hierarchy.depth - substract), vis.minBorderWidth) + "px";
            })
        // end drawing polygons / voronoi regions (i.e. fields)


        // start determining and drawing labels for large fields
        const labelContainer = vis.treemapContainer.select('.label-container').raise()
        const labels = labelContainer.selectAll(".label")
            .data(flattenedHierarchy, d => d.id)

        labels.exit().remove()

        labels.enter().append("text")
            .classed("label", true)
            .attr('id', d => `label-${d.id}`)
            .style('fill', d => d3.color(vis.color(d.data.Amount)).darker(3))
            .style('stroke-width', '0.75em') // adding a border around the labels to ensure legibility inspite of lines on the fields
            .style('stroke-linecap', 'butt')
            .style('stroke-linejoin', 'round')
            .style('paint-order', 'stroke')
            .merge(labels)
            .transition(t)
            .style('stroke', function (d) {
                if ((d.depth === levelI) || (!(d.children) && (d.depth <= levelI))) { return d3.color(vis.color(d.data.Amount)) }
                else { return 'transparent' }
            })
            .attr("font-size", function (d) { // hidding labels of small fields
                if ((d.data.value / vis.absoluteMax > 0.1) & ((d.data.value / hierarchy.value) != 1.0)) { return vis.fontScale(d.data.value) ** 2 / 10 }
                else { return 0 }
            })
            .attr("fill-opacity", function (d) { // hidding labels of fields that are out of scope
                if ((d.depth === levelI) || (!(d.children) && (d.depth <= levelI))) { return 1 }
                else { return 0 }
            })
            .text(function (d) { // formatting labels to xx%
                return d3.format('.' + 0 + 'f')((d.data.value / hierarchy.value) * 100, 2) + "%";
            })
            .attr("transform", function (d) { // placing labels on the centroid of their fields
                if (d.depth === 0) { return null }
                else { return "translate(" + d3.polygonCentroid(d.polygon) + ")" }
            })
        // end determining and drawing labels for large fields


        // start integration of hover information (tooltip)
        const hoverContainer = vis.treemapContainer.select('.hover-container').raise()
        const hoverers = hoverContainer.selectAll(".hoverer")
            .data(flattenedHierarchy.filter(d => {
                return (d.depth === levelI) || (!(d.children) && (d.depth <= levelI))
            }), d => d.id)

        hoverers.exit().remove()

        hoverers.enter().append("path")
            .classed("hoverer", true)
            .attr('id', d => `hover-${d.id}`)
            .merge(hoverers)
            .attr("d", function (d) {
                return "M" + d.polygon.join(",") + "z";
            })
            .style('cursor', 'pointer') // signaling clickability to the user with a pointer cursor
            .on('contextmenu', (event, d) => { // integrating the manual annotation feature
                event.preventDefault()
                vis.drawAnnotations(annotationContainer, hierarchy, d)
            })
            .on('click', (_event, d) => { // integrating the zoom and filter feature
                if (!(d.id.includes('-'))) {
                    landscapeValueSync(vis, d)

                    landscapes.forEach(landscape => {
                        if (vis === landscape) { // redraw the landscape in which the click event took place
                            const vis = landscape
                            vis.drawTreemap(d, vis.currentDepth, true)
                            vis.currentHierarchy = d
                        }
                        else { // redraw the other landscapes in which the click event did not take place
                            landscape.drawTreemap(landscape.currentHierarchy, landscape.currentDepth, true)
                        }
                    })
                    vis.tooltip.hide()
                }
            })
            .on('mouseout', (_event, _d) => vis.tooltip.hide())
            .on('mousemove', (_event, d) => { // integrating the details on demand (hover information) feature
                vis.tooltip
                    .x(d3.polygonCentroid(d.polygon)[0])
                    .y(d3.polygonCentroid(d.polygon)[1])
                    .show(d)
            })
        // end integration of hover information (tooltip)


        // start integration of title/navigation area (roadmap)
        const menu = vis.treemapContainer.select('.menu-container')
        vis.drawRoadmap(menu, hierarchy)
        // end integration of title/navigation area (roadmap)


        // start integration of annotations
        const annotationContainer = vis.treemapContainer.select('.annotation-container')
        vis.drawAnnotations(annotationContainer, hierarchy)
        // end integration of annotations


        // start drawing difference indicator ring and label
        $(document).ready(function () {
            if (vis.treemapCRadius * 0.999 > vis.treemapRadius) {
                vis.treemapContainer.selectAll('.difference-indicator').remove()
                const differenceLabel = vis.treemapContainer.select('.difference-container').append('text')
                    .classed('difference-indicator', true)
                    .attr('dy', -5)
                    .style('font-size', 12)
                    .style('font-family', "'Open Sans', sans-serif")
                    .style('fill', 'grey')
                    .append('textPath')
                    .attr('xlink:href', '#differenceCirc') // bending the difference indicator around the difference ring
                    .style('text-anchor', 'middle')
                    .attr('startOffset', 2 * Math.PI * vis.treemapCRadius * 0.75)
                    .text(`${d3.format(",.0%")(1 - (vis.currentHierarchy.value / vis.absoluteMax))} \u1401`)

                // search (zigzag) algorithm to find a non occluding label position
                let done = false
                let count = 1
                let direction = 1
                while (!done) {
                    done = true
                    vis.svg.selectAll('.annotation-div')._groups[0].forEach(d => {
                        if (colide(d3.select(d).node(), differenceLabel.node())) {
                            differenceLabel.attr('startOffset', Number(differenceLabel.attr('startOffset')) + (count * direction))
                            direction *= -1
                            done = false
                        }
                    })
                    count += 1
                    if (count > 1000) { // limit to ensure that the while loop does not keep running if no satisfying position can be found (would crash the browser otherwise)
                        done = true
                    }
                }
            }
            else {
                vis.treemapContainer.selectAll('.difference-indicator').remove()
            }
        })
        // end drawing difference indicator ring and label

        // after initilization (first render), sets inital run to false to activate transition animations
        vis.initialRun = false

    }

    drawAnnotations(annotationContainer, hierarchy, marking) {
        // this function is responsible for creating and placing the annotations around the impact landscape

        const vis = this


        // start determining and orchestrating automatic and manual annotations
        if (marking) {
            if (vis.markedIds.includes(marking.id)) {
                vis.markedIds = vis.markedIds.filter(d => { return !(d === marking.id) })
            }
            else {
                vis.markedIds.push(marking.id)
            }
        }

        vis.markedCells = hierarchy.descendants().filter(d => {
            return (d.depth === vis.currentDepth) || (!(d.children) && (d.depth <= vis.currentDepth))
        }).sort((a, b) => { return b.value - a.value })

        const markedMax = d3.max(vis.markedCells.map(d => d.data.Amount))

        vis.markedCells = vis.markedCells.filter(d => d.value > markedMax * 0.15).slice(0, vis.annotationNumber) // applying thresholds for automatic filtering

        let markAdditions = vis.markedIds.filter(x => !vis.markedCells.map(d => d.id).includes(x))
        let markDeletions = vis.markedIds.filter(x => vis.markedCells.map(d => d.id).includes(x))

        // adding the fields that were manually selected for annotation
        hierarchy.descendants().filter(d => {
            return (markAdditions.includes(d.id) & d.depth <= vis.currentDepth)
        }).forEach(d => vis.markedCells.push(d))

        // removing the fields that were manually deselected for annotation
        vis.markedCells = vis.markedCells.filter(d => { return !(markDeletions.includes(d.id)) })
        // end determining and orchestrating automatic and manual annotations


        // start creating array of annotation objects
        let groupAnnotations = []
        vis.markedCells.forEach(d => {

            let labelX = d3.polygonCentroid(d.polygon)[0]
            let labelY = d3.polygonCentroid(d.polygon)[1]

            const annotationLength = 3 // maximum number of words in an annotation, afterwards appended with "..."
            groupAnnotations.push({
                note: { // the information displayed in the annotation
                    label: `${d3.format('.' + 3 + 'f')(d.value)} ${d.data.Unit}`,
                    title: `${d.data.Process_shorthand}`.split(' ').slice(0, annotationLength).join(' ') +
                        (`${d.data.Process_shorthand}`.split(' ').length > annotationLength ? ' ...' : '')
                },
                x: labelX, // the x position that is updated during the force placement simulation
                y: labelY, // the y position that is updated during the force placement simulation
                ox: labelX, // the original x position (x coordinate of the polygon centroid)
                oy: labelY, // the original y position (y coordinate of the polygon centroid)
                id: d.id, // the id of the corresponding process
                polygon: d.polygon // the polygon of the corresponding process
            })
        })
        // end creating array of annotation ojects


        // start drawing and placing annotations 
        const annotation = annotationContainer.selectAll('g')
            .data(groupAnnotations, d => d.id)

        annotation.exit().remove()

        const annotation2 = annotation.enter().append('g').merge(annotation)

        annotation2.selectAll('*').remove()

        // creating html DOM elements for the annotations
        const annotation3 = annotation2.append('line')
            .attr('class', 'anno-connector-border')
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .style('stroke-linecap', "round")

        const annotationDiv = annotation2
            .append('foreignObject')
            .classed('annotation-object', true)
            .call(drag())
            .attr('width', vis.annotationWidth)
            .attr('height', vis.annotationHeight)
            .append('xhtml:div')
            .classed('annotation-container-inner', true)
            .append('div')
            .classed('annotation-dummy-div', true)
            .append('div')
            .classed('annotation-div', true)
            .style('border-color', 'transparent')
            .on('contextmenu', (event, d) => { // integrating the manual annotation feature
                event.preventDefault()
                vis.drawAnnotations(annotationContainer, hierarchy, d)
            })

        annotationDiv.append('div')
            .classed('annotation title', true)
            .html(d => `${d.note.title}`)
        annotationDiv
            .append('div')
            .classed('annotation content', true)
            .html(d => `${d.note.label}`)


        // start annotation positioning through force simulation
        const divDimensions = {}
        annotationDiv._groups[0].forEach(d => divDimensions[d.__data__.id] = {
            height: d.getBoundingClientRect().height,
            width: d.getBoundingClientRect().width
        })

        const annotationPadding = 5
        const mapCentroid = d3.polygonCentroid(vis.circlingPolygon)

        // physics based force simulation
        const simulation = d3.forceSimulation(groupAnnotations)
            .force("charge", d3.forceCollide().radius(55)) // collision force to prevent annotations from occluding with each other
            .force("r", d3.forceRadial(vis.treemapRadius + annotationPadding, mapCentroid[0], mapCentroid[1])) // radial force to keep annotations around the impact landscape
            .alphaMin(0.001)
            .tick(10000) // to make force simulation appear static and instant (invisble to user); 1 to animate simulation
            .on("tick", ticked);

        function ticked() {
            // this function is called for every time interval of the simulation
            // it is responsible for updating the positions of the annotations during the simulation

            // determining the connection point of the of the annotation to the field (i.e. should a line be drawn to the center?)
            annotation3.each(d => {
                const originalOX = d.ox
                const originalOY = d.oy
                // for annotions of which the field is adjacent to the treemap border, draw a line to the closest point on the polygon path
                d.ox = closestPoint(
                    vis.dummyPaths.append('path')
                        .datum(d.polygon)
                        .lower()
                        .attr('fill', 'transparent')
                        .attr('d', d3.line().curve(d3.curveLinear))
                        .node(),
                    [d.x, d.y])[0]
                d.oy = closestPoint(
                    vis.dummyPaths.append('path')
                        .datum(d.polygon)
                        .lower()
                        .attr('fill', 'transparent')
                        .attr('d', d3.line().curve(d3.curveLinear))
                        .node(),
                    [d.x, d.y])[1]

                if (((d.ox - d.x) ** 2 + (d.oy - d.y) ** 2) ** 0.5 > annotationPadding + 5) { // for annotations that do not touch the treemap border, draw a line to the centroid of the corresponding field
                    d.ox = originalOX
                    d.oy = originalOY
                }
                d.y = Math.max(
                    mapCentroid[1] - vis.treemapCenter[1] + vis.menuHeight + vis.annotationHeight / 2,
                    Math.min(mapCentroid[1] + vis.treemapCenter[1] - vis.menuHeight, d.y)
                )
            })

            // determining the angle of the annotation to the center of the impact landscape
            annotationDiv.each(d => {
                d.centerAngle = geometric.lineAngle([mapCentroid, [d.x, d.y]])
            })

            // ofsetting the annotation location depending on its placement around the impact landscape
            annotation3.each(d => {
                if (d.centerAngle > -90 & d.centerAngle <= 0) { // 1st quadrant (top right)
                    d.dy = (divDimensions[d.id].height / 2)
                    d.dx = 0
                }
                if (d.centerAngle > -180 & d.centerAngle <= -90) { // 2nd quadrant (top left)
                    d.dy = (divDimensions[d.id].height / 2)
                    d.dx = 0
                }
                if (d.centerAngle > 90 & d.centerAngle <= 180) { // 3rd quadrant (bottom left)
                    d.dy = -(divDimensions[d.id].height / 2)
                    d.dx = 0
                }
                if (d.centerAngle > 0 & d.centerAngle <= 90) { // 4th quadrant (bottom right)
                    d.dy = -(divDimensions[d.id].height / 2)
                    d.dx = 0
                }
            })

            // repositioning the annotation according the force simulation
            annotation2
                .attr('transform', d => `translate(${(d.x - (vis.annotationWidth / 2)) - d.dx}, ${Math.max(mapCentroid[1] - vis.treemapCenter[1] + vis.menuHeight, Math.min(mapCentroid[1] + vis.treemapCenter[1] - vis.menuHeight, (d.y - (vis.annotationHeight / 2)) - d.dy))})`)

            // redrawing the connection line depending on the force simulation
            annotation3
                .attr('x1', d => d.ox)
                .attr('x2', d => d.x)
                .attr('y1', d => d.oy)
                .attr('y2', d => d.y)
                .attr('transform', d => `translate(${- (d.x - vis.annotationWidth / 2) + d.dx}, ${- (Math.max(mapCentroid[1] - vis.treemapCenter[1] + vis.menuHeight, Math.min(mapCentroid[1] + vis.treemapCenter[1] - vis.menuHeight, (d.y - (vis.annotationHeight / 2)) - d.dy)))})`)

            // rotating the annotation depending on its angle to the center for legibility
            annotationDiv
                .style('transform-origin', d => { // determining the rotation point depending on the quadrant in which the annotation is situated
                    if (d.centerAngle > -90 & d.centerAngle <= 0) { // 1st quadrant (top right)
                        return 'bottom center'
                    }
                    if (d.centerAngle > -180 & d.centerAngle <= -90) { // 2nd quadrant (top left)
                        return 'bottom center'
                    }
                    if (d.centerAngle > 90 & d.centerAngle <= 180) { // 3rd quadrant (bottom left)
                        return 'top center'
                    }
                    if (d.centerAngle > 0 & d.centerAngle <= 90) { // 4th quadrant (bottom right)
                        return 'top center'
                    }
                })
                .style('-webkit-transform', d => { // determining the anlge of rotation depending on the quadrant in which the annotation is situated
                    if (d.centerAngle > -90 & d.centerAngle <= 0) { // 1st quadrant (top right)
                        return `rotate(${90 + d.centerAngle}deg)`
                    }
                    if (d.centerAngle > -180 & d.centerAngle <= -90) { // 2nd quadrant (top left)
                        return `rotate(${-270 + d.centerAngle}deg)`
                    }
                    if (d.centerAngle > 90 & d.centerAngle <= 180) { // 3rd quadrant (bottom left)
                        return `rotate(${-90 + d.centerAngle}deg)`
                    }
                    if (d.centerAngle > 0 & d.centerAngle <= 90) { // 4th quadrant (bottom right)
                        return `rotate(${270 + d.centerAngle}deg)`
                    }
                })
        }
        // end annotation positioning through force simulation
        // end drawing and placing annotations
    }

    drawRoadmap(menu, hierarchy) {
        // this function is responsible for drawing the title/navigation area (roadmap)

        // initializing some variables
        const vis = this
        const t = d3.transition().duration(vis.initialRun ? 0 : 500) // the transition animation used in the roadmap


        // start drawing the title and focal process information
        menu.append('g').classed('menu-roadmap', true)

        let menuTitleContent = menu.selectAll('.menu-title-container')
            .data([hierarchy.depth], d => d)

        menuTitleContent.exit().remove()

        let titleUpper = ''
        const titlePreScripts = ['<span style="vertical-align: 1px">\u29BF</span>', ..._.range(1, 50)]

        hierarchy.ancestors().reverse().forEach((d, i) => { // determining the interaction history
            if (i === hierarchy.ancestors().reverse().length - 1) {
                return ''
            }
            else {
                return titleUpper += titlePreScripts[i] + (i != 0 ? '.' : '') + ' ' + d.data.Process_shorthand + ' \u203A '
            }
        })

        menuTitleContent = menuTitleContent.enter().append('g')
            .attr('class', 'menu-title-container')
            .append('foreignObject')
            .attr('width', vis.svgWidth * 1.35) // making the title area extend a little beyond the treemap radius to allow for larger titles and to compensate for unused buffer area that is allocated to annotations
            .attr('height', vis.menuHeight)
            .attr('transform', `translate(${-(vis.svgWidth * 1.35 - vis.menuBands.range()[1]) / 2}, ${-vis.menuBandWidth - vis.menuHeight - 10})`)
            .append('xhtml:div')
            .append('div')
            .classed('menu-title-parent', true)
            .append('div')
            .classed('menu-title', true)
            .html(`<div style="font-family: 'Open Sans', sans-serif; color: grey; font-size: 10px; line-height: normal; display: block;">${titleUpper}</div>` +
                `${hierarchy.data.Process}<br><span style="font-family: 'Open Sans', sans-serif; font-size: 13px">(${d3.format('.2f')(hierarchy.value)} ${hierarchy.data.Unit})${hierarchy.data.Location != '-' ? ' - ' + hierarchy.data.Location : ''}</span>`)
            .merge(menuTitleContent)
        // end drawing the title and focal process information    


        // start drawing the navigation / roadmap and implementing interaction
        const menuRoadMap = menu.select('.menu-roadmap')

        // drawing the lines of the roadmap
        const menuLines = menuRoadMap.selectAll('.menu-line')
            .data(_.range(hierarchy.depth, hierarchy.depth + hierarchy.height + 1), d => d)

        menuLines.exit()
            .attr('stroke', d => d < hierarchy.depth ? vis.minColor : d > hierarchy.height + 1 ? 'white' : vis.minColor)

        menuLines.enter().append('line')
            .classed('menu-line', true)
            .merge(menuLines)
            .transition(t)
            .attr('x1', d => vis.menuBands(d) + (vis.menuBands.bandwidth() - vis.menuBandWidth) / 2)
            .attr('y1', - vis.menuBandWidth / 2)
            .attr('x2', (d, _i, _list) => {
                const startWidth = d === 0 ? vis.menuBands(d) : vis.menuBands(d - 1) + vis.menuBandWidth
                return startWidth + (vis.menuBands.bandwidth() - vis.menuBandWidth) / 2
            })
            .attr('y2', - vis.menuBandWidth / 2)
            .attr('stroke', d => {
                if (d === hierarchy.depth) { return vis.minColor }
                else { return 'lightgrey' }
            })
            .attr('stroke-width', vis.menuBandWidth / 10)

        // drawing the dots of the roadmap
        const menuItems = menuRoadMap.selectAll('.menu-circle')
            .data(_.range(hierarchy.depth, hierarchy.depth + hierarchy.height + 1), d => d)

        menuItems.exit()
            .transition(t)
            .attr('fill', 'white')
            .attr('stroke', d => {
                if (d < hierarchy.depth) { return vis.minColor }
                else {
                    if (d > hierarchy.height + 1) { return 'white' }
                    else { return vis.minColor }
                }
            })

        menuItems.enter().append('circle')
            .classed('menu-circle', true)
            .merge(menuItems)
            .transition(t)
            .attr('cx', d => vis.menuBands(d) + vis.menuBandWidth / 2 + (vis.menuBands.bandwidth() - vis.menuBandWidth) / 2)
            .attr('cy', - vis.menuBandWidth / 2)
            .attr('r', vis.menuBandWidth / 2)
            .attr('fill', d => { // painting the focal dot differently based on minColor
                if (d === hierarchy.depth) { return vis.minColor }
                else { return 'white' }
            })
            .attr('stroke', d => { // determinin the dot border colors
                if (d === vis.currentDepth) { return 'black' }
                else {
                    if (d === hierarchy.depth) { return vis.minColor }
                    else { return 'lightgrey' }
                }
            }) 
            .attr('stroke-width', d => { // painting the dot that signals the zoom level with a thicker border
                if (d === vis.currentDepth) { return 2 } 
                else { return 1 }
            }) 

        // drawing the labels of the roadmap
        const manuXAxis = d3.axisBottom(vis.menuBands);

        menuRoadMap.select('.manuXAxis').remove()

        menuRoadMap.append('g')
            .attr('class', 'manuXAxis')
            .attr('transform', `translate(0, ${-vis.menuBandWidth})`)
            .call(manuXAxis)

        // fixing the roadmap label placement to adjust for different screen resolutions and the root product
        menuRoadMap.selectAll('.manuXAxis .tick text')
            .attr('dy', (_d, i, element) => - element[i].getBBox().y)
            .attr('color', d => {
                if (d === hierarchy.depth) { return 'white' }
                else {
                    if (d <= hierarchy.ancestors().reverse()[0].height) { return 'black' }
                    else { return 'white' }
                }
            })
            .attr('font-size', Math.min(Math.max(vis.menuBandWidth * 0.5, 10), 13))
            .attr('transform', `translate(0, ${vis.menuBandWidth / 2})`)
            .text(d => d === 0 ? '\u29BF' : d)

        menuRoadMap.attr('transform', `translate(${(vis.maxHeight - hierarchy.ancestors().reverse()[0].height) * ((vis.menuBands(1) - vis.menuBands(0)) / 2)},0)`)

        // invisble buttons to implement the return interaction (left of focal dot)
        const menuButtons = menuRoadMap.selectAll('.menu-button')
            .data([...Array(hierarchy.depth).keys()]).raise()

        menuButtons.exit().remove()

        menuButtons.enter().append('circle')
            .classed('menu-button', true)
            .raise()
            .merge(menuButtons)
            .attr('cx', d => vis.menuBands(d) + vis.menuBandWidth / 2 + (vis.menuBands.bandwidth() - vis.menuBandWidth) / 2)
            .attr('cy', - vis.menuBandWidth / 2)
            .attr('r', vis.menuBandWidth / 2)
            .attr('fill', 'transparent')
            .style('cursor', 'pointer') // signaling that the roadmap is clickable by implementing pointer cursors
            .on('click', (_event, d) => {
                landscapeValueSync(vis, hierarchy.ancestors().reverse()[d])
                landscapes.forEach(landscape => {
                    if (vis === landscape) { // redraw the landscape in which the click event took place
                        const vis = landscape
                        vis.currentDepth = d + 1
                        vis.drawTreemap(hierarchy.ancestors().reverse()[d], vis.currentDepth, true)
                        vis.currentHierarchy = hierarchy.ancestors().reverse()[d]
                    }
                    else { // redraw the other landscapes in which the click event did not take place
                        landscape.drawTreemap(landscape.currentHierarchy, landscape.currentDepth, true)
                    }
                })
            })

        // invisible selectors to implement to zoom interaction (right of focal dot)
        const menuSelectors = menuRoadMap.selectAll('.menu-selector')
            .data(_.range(hierarchy.depth + 1, hierarchy.depth + hierarchy.height + 1), d => d).raise()

        menuSelectors.exit().remove()

        menuSelectors.enter().append('circle')
            .classed('menu-selector', true)
            .raise()
            .merge(menuSelectors)
            .attr('cx', d => vis.menuBands(d) + vis.menuBandWidth / 2 + (vis.menuBands.bandwidth() - vis.menuBandWidth) / 2)
            .attr('cy', - vis.menuBandWidth / 2)
            .attr('r', vis.menuBandWidth / 2)
            .attr('fill', 'transparent')
            .style('cursor', 'pointer') // signaling that the roadmap is clickable by implementing pointer cursors
            .on('click', (_event, d) => {
                vis.currentDepth = d
                vis.drawTreemap(hierarchy, d)
                vis.currentHierarchy = hierarchy
            })
        // end drawing the navigation / roadmap and implementing interaction
    }

    drawTooltip(params) {
        // this function is responsible for drawing and implementing the hover informatinon window
        // adapted from https://github.com/bumbeishvili/d3-tooltip

        // initializing some variables
        const attrs = {
            container: 'body',
            arrowHeight: 10,
            arrowLength: 20,
            tooltipFill: "rgb(255, 255, 255)",
            x: null,
            y: null,
            data: { "id": "you should provide data using .show(d)" },
            absoluteMax: 1
        };

        const attrKeys = Object.keys(attrs);
        attrKeys.forEach(function (key) {
            if (params && params[key]) {
                attrs[key] = params[key];
            }
        })

        // the functions that will show and hide the hover information window
        let displayTooltip;
        let hideTooltip;

        // main tooltip object
        const main = function (selection) {
            selection.each(function scope() {

                // hide tooltip
                hideTooltip = function () {
                    attrs.container.selectAll(".tooltipContent").remove();
                }

                // show tooltip
                displayTooltip = function () {

                    // assign x and y positions
                    let x = attrs.x;
                    let y = attrs.y;

                    // check container type first and transform if necessary
                    if (!(attrs.container instanceof d3.selection)) {
                        attrs.container = d3.select(attrs.container);
                    }

                    // remove tooltipcontent if exists
                    attrs.container.selectAll(".tooltip-container").remove();

                    // tooltip content wrapper
                    const totalWrapper = attrs.container
                        .append("g")
                        .attr("class", "tooltip-container")

                    // tooltip content wrapper
                    const tooltipContentWrapper = totalWrapper
                        .append("g")
                        .attr("class", "tooltipContent")
                        .attr("pointer-events", "none");

                    // tooltip wrapper
                    const tooltipWrapper = tooltipContentWrapper
                        .append("g")
                        .style("pointer-events", "none");

                    // tooltip path (shape)
                    tooltipWrapper.append("path");

                    // row contents wrapper
                    const g = tooltipWrapper.append("g");

                    // create a html DOM foreignObject to display the additional information
                    const content = g.append('foreignObject')
                        .classed('hover-content-container', true)
                        .attr('width', '350')
                        .attr('height', '300')
                        .append('xhtml:div')
                        .append('div')
                        .classed('hover-content-table-div', true)
                        .style('background-color', attrs.tooltipFill)
                        .append('table')
                        .classed('hover-content-table', true)

                    // implement the additional information related to the hovered process
                    const hoverContent = [
                        {
                            left: 'Process Name <em>(id)</em>',
                            right: `${attrs.data.data.Process} <em>(${attrs.data.id})</em>`
                        },
                        {
                            left: 'Life Cycle Phase',
                            right: `${attrs.data.data.Phase}`
                        },
                        {
                            left: 'Reference Location',
                            right: `${attrs.data.data.Location}`
                        },
                        {
                            left: 'Impact',
                            right: `${(attrs.data.id === '-' ? '\u25BC ' : '') + d3.format('.' + 3 + 'f')(attrs.data.data.value)} ${attrs.data.data.Unit} (${d3.format('.' + 2 + 'f')((attrs.data.data.value / (attrs.data.id === '-' ? attrs.absoluteMax : maxTreeValue(attrs.data))) * 100, 2)}% of total)`
                        }
                    ]

                    // structure the additional information in a left and right column (attribute: value)
                    hoverContent.forEach(d => {
                        const row = content.append('tr')
                        row.append('td')
                            .classed('left-column', true)
                            .html(d.left)
                        row.append('td')
                            .classed('right-column', true)
                            .html(d.right)
                    })

                    // calculating dimensions
                    const height = g.select('.hover-content-table-div').node().getBoundingClientRect().height
                    const halfArrowLength = attrs.arrowLength / 2;
                    const fullWidth = g.select('.hover-content-table-div').node().getBoundingClientRect().width;
                    const halfWidth = fullWidth / 2;

                    // building string paths including an arrow shape
                    const bottomArrowPos = ` L ${halfWidth - halfArrowLength}  ${height}  L ${halfWidth} ${height + attrs.arrowHeight}  L ${halfWidth + halfArrowLength} ${height}`
                    const strPath = `M 0 0 L 0  ${height} ${bottomArrowPos} L ${fullWidth} ${height} L ${fullWidth} 0 L 0 0 `;

                    // translate tooltip content based on configuration
                    tooltipContentWrapper.attr("transform", `translate(${x},${y})`);

                    // creating a mask to fix dropshadow around hover info window
                    const mask = tooltipWrapper.append('defs')
                        .append('mask')
                        .attr('id', 'invisible')

                    mask.append('rect')
                        .attr('width', '100%')
                        .attr('height', '100%')
                        .attr("fill", 'white')

                    mask.append('rect')
                        .attr('width', fullWidth)
                        .attr('height', height)
                        .attr("fill", 'black')

                    // appending actual path and mask
                    tooltipWrapper
                        .select("path")
                        .attr("d", strPath)
                        .attr("fill", attrs.tooltipFill)
                        .attr('mask', 'url(#invisible)').raise();

                    // final translation to match provided x and y position
                    tooltipWrapper.attr(
                        "transform",
                        `translate(${-halfWidth},${-height - attrs.arrowHeight})`
                    );
                }
            });
        };

        // dynamic keys functions to load provided attributes
        Object.keys(attrs).forEach(key => {
            // Attach variables to main function
            return main[key] = function (_) {
                const string = `attrs['${key}'] = _`;
                if (!arguments.length) { return eval(` attrs['${key}'];`); }
                eval(string);
                return main;
            };
        });

        //set attrs as property
        main.attrs = attrs;

        main.show = function (data) {
            if (data) {
                attrs.data = data;
            }
            displayTooltip();
        }

        main.hide = function () {
            hideTooltip();
        }
        // run  visual
        main.run = function () {
            d3.selectAll(attrs.container).call(main);
            return main;
        }

        return main.run();
    }
}