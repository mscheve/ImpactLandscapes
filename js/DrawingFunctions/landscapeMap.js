class LandscapeMap {
    constructor(_parentElement, _hierarchy, _width, _height, _color, _absoluteMax, _maxHeight, _annotationNumber) {
        this.svgWidth = _width
        this.svgHeight = _height
        this.parentElement = _parentElement
        this.hierarchy = _hierarchy
        this.color = _color
        this.absoluteMax = _absoluteMax
        this.maxHeight = _maxHeight
        this.annotationNumber = _annotationNumber
        this.initVis()
    }

    initVis() {
        const vis = this

        // vis.halfWidth = vis.svgWidth / 2
        // vis.halfHeight = vis.svgHeight / 2
        vis.menuHeight = 100
        vis.annotationHeight = 75
        vis.annotationWidth = 150
        vis.treemapRadius = (Math.min((vis.svgWidth / 2), ((vis.svgHeight - vis.annotationHeight) / 2) - vis.menuHeight))
        vis.treemapCenter = [vis.svgWidth / 2, ((vis.svgHeight + vis.menuHeight)/2) ]
        vis.minColor = '#4e8200'
        vis.midColor = '#ffe600'
        vis.maxColor = '#4f3515'
        vis.outerColor = '#1d260f'
        vis.waveColor = '#237dc2'
        vis.minBorderWidth = 1
        vis.maxBorderWidth = 6
        vis.noLevelsDisplayed = 2
        vis.minLabelSize = 12
        vis.maxLabelSize = 12
        vis.stroke_delta = (vis.maxBorderWidth - vis.minBorderWidth) * 1.0 / vis.noLevelsDisplayed
        vis.markedIds = [];

        vis.initialRun = true
        vis.currentDepth = 1

        vis._voronoiTreemap = d3.voronoiTreemap()
            .convergenceRatio([0.01])
            .maxIterationCount([250]);

        vis.fontScale = d3.scaleLinear().range([vis.minLabelSize, vis.maxLabelSize]).clamp(true);

        vis.menuBands = d3.scaleBand()
            .range([0, vis.treemapRadius * 2])
            .paddingInner(0.2)

        vis.currentHierarchy = vis.hierarchy

        vis.menuBandWidth = vis.menuBands.domain([...Array(vis.maxHeight + 1).keys()]).bandwidth()

        vis.menuBands.domain([...Array(vis.maxHeight + 1).keys()])

        vis.circlingPolygon = computeCirclingPolygon(vis.treemapRadius);
        vis.initLayout();
        vis.drawTreemap(vis.hierarchy, vis.currentDepth);
    }

    initLayout() {

        const vis = this
        const treemapRadius = vis.treemapRadius
        const treemapCenter = vis.treemapCenter

        vis.svg = d3.select(vis.parentElement)

        vis.treemapContainer = vis.svg.append("g")
            .classed("treemap-container", true)
            .attr("transform", "translate(" + treemapCenter + ")");

        vis.dummyPaths = vis.treemapContainer.append('g')
            .classed('dummy-container', true)

        const containerList = [
            'polygon-container',
            'cell-container',
            'label-container',
            'annotation-container',
            'menu-container',
            'hover-container',
        ]

        containerList.forEach(d => {
            vis.treemapContainer.append('g')
                .classed(d, true)
                .attr("transform", "translate(" + [-treemapRadius, -treemapRadius] + ")")
        })

        vis.tooltip = d3.componentsTooltip()
            .container(vis.treemapContainer.select('.hover-container'))
            .absoluteMax(vis.absoluteMax)

        vis.treemapContainer.select('.menu-container')
            .attr('transform', `translate(${[-treemapRadius, -treemapCenter[1] + vis.menuHeight]})`)

        vis.textureContainer = vis.treemapContainer.select('.cell-container')
            .append('g')
            .classed('texture-container', true)

        vis.treemapContainer.select('.polygon-container')
            .append("path")
            .classed('ground-shape', true)
            .attr("d", "M" + vis.circlingPolygon.join(",") + "Z")
            .style('stroke-width', vis.maxBorderWidth)
            .style('stroke', vis.outerColor);
    }

    drawTreemap(hierarchy, levelI) {

        const vis = this

        if (vis.currentDepth <= hierarchy.depth) {
            vis.currentDepth = hierarchy.children ? hierarchy.depth + 1 : hierarchy.depth
            levelI = vis.currentDepth
        }

        if (vis.currentDepth > hierarchy.depth + hierarchy.height) {
            vis.currentDepth = hierarchy.depth
        }

        vis.fontScale.domain([leaveValues(hierarchy)[0], leaveValues(hierarchy)[1]])

        const t = d3.transition().duration(vis.initialRun ? 0 : 750)

        if ((hierarchy.id != vis.currentHierarchy.id) || vis.initialRun) {
            vis._voronoiTreemap.clip(vis.circlingPolygon)(hierarchy);
        }

        const flattenedHierarchy = flattenHierarchy(hierarchy)

        //drawing voronoi cells
        const cellContainer = vis.treemapContainer.select('.cell-container')
        const cells = cellContainer.selectAll(".cell")
            .data(flattenedHierarchy, d => d.id)

        cells.exit().remove()

        cells.enter().append("path")
            .classed("cell", true)
            .attr('id', d => `cell-${d.id}`)
            .style("fill-opacity", function (d) { return (d.depth === levelI) || (!(d.children) && (d.depth <= levelI)) ? 1 : 0; })
            .style("fill", d => d.depth === 0 ? vis.outerColor : 
                d.id === '-' ? 
                    waveGenerator(vis.textureContainer, vis.waveColor, d3.color(vis.waveColor).darker(-0.4), 15) : 
                    lineGenerator(vis.textureContainer, vis.color(d.data.Amount), d3.color(vis.color(d.data.Amount)).darker(0.4)))//function(d,i){return color(d.data.Amount)})
            .style('stroke', _d => d3.color(vis.outerColor))
            .style('stroke-linejoin', 'round')
            .merge(cells)
            .transition(t)
            .style("fill-opacity", function (d) { return (d.depth === levelI) || (!(d.children) && (d.depth <= levelI)) ? 1 : 0; })
            .attr("d", function (d) { return "M" + d.polygon.join(",") + "z"; })
            .style('stroke-width', function (d) {
                const substract = d.depth === hierarchy.depth + 1 ? 1 : 0
                return Math.max(vis.maxBorderWidth - vis.stroke_delta * (d.depth - hierarchy.depth - substract), vis.minBorderWidth) + "px";
            });

        //drawing annotations around voronoi treemap
        const annotationContainer = vis.treemapContainer.select('.annotation-container')
        vis.drawAnnotations(annotationContainer, hierarchy)

        //drawing labels in voronoi cells
        const labelContainer = vis.treemapContainer.select('.label-container').raise()
        const labels = labelContainer.selectAll(".label")
            .data(flattenedHierarchy, d => d.id)

        labels.exit().remove()

        labels.enter().append("text")
            .classed("label", true)
            .attr('id', d => `label-${d.id}`)
            .style('fill', d => d.id === '-' ? 'white' : d3.color(vis.color(d.data.Amount)).darker(3))
            .style('stroke-width', '0.75em')
            .style('stroke-linecap', 'butt')
            .style('stroke-linejoin', 'round')
            .style('paint-order', 'stroke')
            .merge(labels)
            .transition(t)
            .style('stroke', function (d) { return d.id === '-' ? vis.waveColor : (d.depth === levelI) || (!(d.children) && (d.depth <= levelI)) ? d3.color(vis.color(d.data.Amount)) : 'transparent'; })
            .attr("font-size", function (d) { return d.data.value / leaveValues(hierarchy)[1] > 0.1 ? vis.fontScale(d.data.value) ** 2 / 10 : 0; })
            .attr("fill-opacity", function (d) { return (d.depth === levelI) || (!(d.children) && (d.depth <= levelI)) ? 1 : 0; })
            .text(function (d) { return (d.id === '-' ? '\u25BC (' : '') + d3.format('.' + 0 + 'f')((d.data.value / (d.id === '-' ? vis.absoluteMax : hierarchy.value)) * 100, 2) + "%" + (d.id === '-' ? ')' : ''); })
            .attr("transform", function (d) { return d.depth === 0 ? null : "translate(" + d3.polygonCentroid(d.polygon) + ")"; })

        //drawing hover info and paths
        const hoverContainer = vis.treemapContainer.select('.hover-container').raise()
        const hoverers = hoverContainer.selectAll(".hoverer")
            .data(flattenedHierarchy.filter(d => { return (d.depth === levelI) || (!(d.children) && (d.depth <= levelI)) }), d => d.id)

        hoverers.exit().remove()

        hoverers.enter().append("path")
            .classed("hoverer", true)
            .attr('id', d => `hover-${d.id}`)
            .merge(hoverers)
            .attr("d", function (d) { return "M" + d.polygon.join(",") + "z"; })
            .style('cursor', 'pointer')
            .on('contextmenu', (event, d) => {
                event.preventDefault()
                vis.drawAnnotations(annotationContainer, hierarchy, d)
            })
            .on('click', (_event, d) => {
                vis.drawTreemap(d, vis.currentDepth)
                vis.currentHierarchy = d
            })
            .on('mouseout', (_event, _d) => vis.tooltip.hide())
            .on('mouseover', (_event, d) => {
                vis.tooltip
                    .x(d3.polygonCentroid(d.polygon)[0])
                    .y(d3.polygonCentroid(d.polygon)[1])
                    .show(d)
            })

        //drawing menu above voronoi treemap

        const menu = vis.treemapContainer.select('.menu-container')
        menu.append('g').classed('menu-roadmap', true)
        const menuRoadMap = menu.select('.menu-roadmap', true)

        const menuLines = menuRoadMap.selectAll('.menu-line')
            .data(_.range(hierarchy.depth, hierarchy.depth + hierarchy.height + 1), d => d)

        menuLines.exit()
            .attr('stroke', d => d < hierarchy.depth ? vis.minColor : d > hierarchy.height + 1 ? 'white' : vis.minColor)

        menuLines.enter().append('line')
            .classed('menu-line', true)
            .merge(menuLines)
            .transition(t)
            .attr('x1', d => vis.menuBands(d) + (vis.menuBands.bandwidth() - vis.menuBandWidth)/2)
            .attr('y1', - vis.menuBandWidth / 2)
            .attr('x2', (d, _i, _list) => (d === 0 ? vis.menuBands(d)  : vis.menuBands(d - 1) + vis.menuBandWidth) + (vis.menuBands.bandwidth() - vis.menuBandWidth)/2)
            .attr('y2', - vis.menuBandWidth / 2)
            .attr('stroke', d => d === hierarchy.depth ? vis.minColor : 'lightgrey')
            .attr('stroke-width', vis.menuBandWidth / 10)

        const menuItems = menuRoadMap.selectAll('.menu-circle')
            .data(_.range(hierarchy.depth, hierarchy.depth + hierarchy.height + 1), d => d)

        menuItems.exit()
            .transition(t)
            .attr('fill', d => d < hierarchy.depth ? 'white' : d > hierarchy.height + 1 ? 'white' : 'white')
            .attr('stroke', d => d < hierarchy.depth ? vis.minColor : d > hierarchy.height + 1 ? 'white' : vis.minColor)

        menuItems.enter().append('circle')
            .classed('menu-circle', true)
            .merge(menuItems)
            .transition(t)
            .attr('cx', d => vis.menuBands(d) + vis.menuBandWidth / 2 + (vis.menuBands.bandwidth() - vis.menuBandWidth)/2)
            .attr('cy', - vis.menuBandWidth / 2)
            .attr('r', vis.menuBandWidth / 2)
            .attr('fill', d => d === hierarchy.depth ? vis.minColor : 'white')
            .attr('stroke', d => d === vis.currentDepth ? 'black' : d === hierarchy.depth ? vis.minColor : 'lightgrey')
            .attr('stroke-width', d => d === vis.currentDepth ? 2 : 1)
        

        const manuXAxis = d3.axisBottom(vis.menuBands);
        menuRoadMap.select('.manuXAxis').remove()
        menuRoadMap.append('g')
            .attr('class', 'manuXAxis')
            .attr('transform', `translate(0, ${-vis.menuBandWidth})`)
            .call(manuXAxis)
        menuRoadMap.selectAll('.manuXAxis .tick text')
            .attr('dy', (_d, i, element) => (vis.menuBandWidth / 2) - (element[i].clientHeight / 2))
            .attr('color', d => (d === hierarchy.depth) ? 'white' : d <= hierarchy.ancestors().reverse()[0].height ? 'black' : 'white')
            .text(d => d === 0 ? '\u29BF' : d)

        menuRoadMap.attr('transform', `translate(${(vis.maxHeight - hierarchy.ancestors().reverse()[0].height) * ((vis.menuBands(1) - vis.menuBands(0)) / 2)},0)`)

        const menuButtons = menuRoadMap.selectAll('.menu-button')
            .data([...Array(hierarchy.depth).keys()]).raise()

        menuButtons.exit().remove()

        menuButtons.enter().append('circle')
            .classed('menu-button', true)
            .raise()
            .merge(menuButtons)
            .attr('cx', d => vis.menuBands(d) + vis.menuBandWidth / 2 + (vis.menuBands.bandwidth() - vis.menuBandWidth)/2)
            .attr('cy', - vis.menuBandWidth / 2)
            .attr('r', vis.menuBandWidth / 2)
            .attr('fill', 'transparent')
            .style('cursor', 'pointer')
            .on('click', (_event, d) => {
                vis.drawTreemap(hierarchy.ancestors().reverse()[d], vis.currentDepth)
                vis.currentHierarchy = hierarchy.ancestors().reverse()[d]
            })

        const menuSelectors = menuRoadMap.selectAll('.menu-selector')
            .data(_.range(hierarchy.depth+1, hierarchy.depth + hierarchy.height + 1), d => d).raise()

        menuSelectors.exit().remove()

        menuSelectors.enter().append('circle')
            .classed('menu-selector', true)
            .raise()
            .merge(menuSelectors)
            .attr('cx', d => vis.menuBands(d) + vis.menuBandWidth / 2 + (vis.menuBands.bandwidth() - vis.menuBandWidth)/2)
            .attr('cy', - vis.menuBandWidth / 2)
            .attr('r', vis.menuBandWidth / 2)
            .attr('fill', 'transparent')
            .style('cursor', 'pointer')
            .on('click', (_event, d) => {
                vis.currentDepth = d
                vis.drawTreemap(hierarchy, d)
                vis.currentHierarchy = hierarchy
            })

        let menuTitleContent = menu.selectAll('.menu-title-container')
            .data([hierarchy.depth], d => d)

        menuTitleContent.exit().remove()

        menuTitleContent = menuTitleContent.enter().append('g')
            .attr('class', 'menu-title-container')
            .append('foreignObject')
            .attr('width', vis.menuBands.range()[1])
            .attr('height', vis.menuHeight)
            .attr('transform', `translate(0, ${-vis.menuBandWidth - vis.menuHeight - 10})`)
            .append('xhtml:div')
            .append('div')
            .classed('menu-title-parent', true)
            .append('div')
            .classed('menu-title', true)
            .html(hierarchy.data.Process)
            .merge(menuTitleContent)

        //after first draw, set inital run to false to activate transition animations
        vis.initialRun = false
    }

    drawAnnotations(annotationContainer, hierarchy, marking) {
        
        const vis = this
        
        if (marking) {
            vis.markedIds.includes(marking.id) ? vis.markedIds = vis.markedIds.filter(d => {return !(d === marking.id)}) : vis.markedIds.push(marking.id) 
        }

        vis.markedCells = hierarchy.descendants().filter(d => {
            return (d.depth === vis.currentDepth) || (!(d.children) && (d.depth <= vis.currentDepth))
            // return (d.depth === 1)
        }).sort((a, b) => { return b.value - a.value }).slice(0, vis.annotationNumber)

        console.log(vis.markedIds)
        let markAdditions = vis.markedIds.filter(x => !vis.markedCells.map(d => d.id).includes(x))
        let markDeletions = vis.markedIds.filter(x => vis.markedCells.map(d => d.id).includes(x))
        console.log(markDeletions)

        hierarchy.descendants().filter(d => {
            return (markAdditions.includes(d.id) & d.depth <= vis.currentDepth)
            // return (d.depth === 1)
        }).forEach(d => vis.markedCells.push(d))

        vis.markedCells = vis.markedCells.filter(d => {return !(markDeletions.includes(d.id))})


        let groupAnnotations = groupAnnotationCreator(vis.markedCells)

        const annotation = annotationContainer.selectAll('g')
            .data(groupAnnotations, d => d.id)

        annotation.exit().remove()

        const annotation2 = annotation.enter().append('g').merge(annotation)

        annotation2.selectAll('*').remove()

        const annotation3 = annotation2.append('line')
            .attr('class', 'anno-connector-border')
            .attr('stroke', 'white')//vis.outerColor)
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
            .on('contextmenu', (event, d) => {
                event.preventDefault()
                vis.drawAnnotations(annotationContainer, hierarchy, d)
            })

        annotationDiv.append('div')
            .classed('annotation title', true)
            // .style('color', d => d.id === '-' ? vis.waveColor : 'black')
            .html(d => `${d.note.title}`)
        annotationDiv
            .append('div')
            .classed('annotation content', true)
            // .style('color', d => d.id === '-' ? vis.waveColor : 'black')
            .html(d => `${d.note.label}`)

        const divDimensions = {}

        annotationDiv._groups[0].forEach(d => divDimensions[d.__data__.id] = { height: d.getBoundingClientRect().height, width: d.getBoundingClientRect().width })
        
        const annotationPadding = 5
        const mapCentroid = d3.polygonCentroid(vis.circlingPolygon)
        const simulation = d3.forceSimulation(groupAnnotations)
            .force("charge", d3.forceCollide().radius(50))
            .force("r", d3.forceRadial(vis.treemapRadius + annotationPadding, mapCentroid[0], mapCentroid[1]))
            .force('x', d => d3.forceCenter(d.x, d.y))
            .alphaMin(0.001)
            .tick(10000) //to make simulation appear static
            .on("end", ticked);

        function ticked() {

            annotation3.each(d => {
                // marking ? console.log(d.id === marking.id) : null
                const originalOX = d.ox
                const originalOY = d.oy
                d.ox = closestPoint(vis.dummyPaths.append('path').datum(d.polygon).lower().attr('fill', 'transparent').attr('d', d3.line().curve(d3.curveLinear)).node(), [d.x, d.y])[0]
                d.oy = closestPoint(vis.dummyPaths.append('path').datum(d.polygon).lower().attr('fill', 'transparent').attr('d', d3.line().curve(d3.curveLinear)).node(), [d.x, d.y])[1]
                if (((d.ox - d.x)**2 + (d.oy - d.y)**2)**0.5 > annotationPadding + 5) {
                    d.ox = originalOX
                    d.oy = originalOY
                }
                d.y = Math.max(mapCentroid[1] - vis.treemapCenter[1] + vis.menuHeight + vis.annotationHeight / 2, Math.min(mapCentroid[1] + vis.treemapCenter[1] - vis.menuHeight, d.y))
            })
            annotationDiv.each(d => {
                d.annotationAngle = geometric.lineAngle([[d.ox, d.oy], [d.x, d.y]])
            })

            annotationDiv.each(d => {
                d.centerAngle = geometric.lineAngle([mapCentroid, [d.x, d.y]])
            })
            
            annotationDiv.e

            annotation3.each(d => {
                // if ((d.centerAngle <= 0 & d.centerAngle > -45) || (d.centerAngle <= 45 & d.centerAngle > 0)) {
                //     d.dx = -(divDimensions[d.id].width / 2)
                //     d.dy = 0
                // }
                // if (d.centerAngle <= -45 & d.centerAngle > -135) {
                //     d.dy = (divDimensions[d.id].height / 2)
                //     d.dx = 0
                // }
                // if ((d.centerAngle <= -135 & d.centerAngle >= -180) || (d.centerAngle <= 180 & d.centerAngle > 135)) {
                //     d.dx = (divDimensions[d.id].width / 2)
                //     d.dy = 0
                // }
                // if (d.centerAngle <= 135 & d.centerAngle > 45) {
                //     d.dy = -(divDimensions[d.id].height / 2)
                //     d.dx = 0
                // }
                if (d.centerAngle > 90 & d.centerAngle <= 180) {
                    d.dy = -(divDimensions[d.id].height / 2)
                    d.dx = 0
                }
                if (d.centerAngle > -90 & d.centerAngle <= 0) {
                    d.dy = (divDimensions[d.id].height / 2)
                    d.dx = 0
                }
                if (d.centerAngle > -180 & d.centerAngle <= -90) {
                    d.dy = (divDimensions[d.id].height / 2)
                    d.dx = 0
                }
                if (d.centerAngle > 0 & d.centerAngle <= 90) {
                    d.dy = -(divDimensions[d.id].height / 2)
                    d.dx = 0
                }
                // if (d.centerAngle > 0 & d.centerAngle <= 90) {
                //     return 'top center'
                // }
                // if (d.centerAngle > -90 & d.centerAngle <= 0) {
                //     return 'bottom center'
                // }
                // if (d.centerAngle > 90 & d.centerAngle <= 180) {
                //     return 'bottom center'
                // }
                // if (d.centerAngle > -180 & d.centerAngle <= -90) {
                //     return 'top center'
                // }
            })

            annotation2
                .attr('transform', d => `translate(${(d.x - (vis.annotationWidth / 2)) - d.dx}, ${Math.max(mapCentroid[1] - vis.treemapCenter[1] + vis.menuHeight, Math.min(mapCentroid[1] + vis.treemapCenter[1] - vis.menuHeight, (d.y - (vis.annotationHeight / 2)) - d.dy))})`)

            annotation3
                .attr('x1', d => d.ox)
                .attr('x2', d => d.x)
                .attr('y1', d => d.oy)
                .attr('y2', d => d.y)
                .attr('transform', d => `translate(${- (d.x - vis.annotationWidth / 2) + d.dx}, ${- (Math.max(mapCentroid[1] - vis.treemapCenter[1] + vis.menuHeight, Math.min(mapCentroid[1] + vis.treemapCenter[1] - vis.menuHeight, (d.y - (vis.annotationHeight / 2)) - d.dy)))})`)

            annotationDiv
                .style('border-left-style', d => (d.centerAngle <= 0 & d.centerAngle > -45) || (d.centerAngle <= 45 & d.centerAngle > 0) ? 'solid' : 'hidden')
                .style('border-bottom-style', d => d.centerAngle <= -45 & d.centerAngle > -135 ? 'solid' : 'hidden')
                .style('border-right-style', d => (d.centerAngle <= -135 & d.centerAngle >= -180) || (d.centerAngle <= 180 & d.centerAngle > 135) ? 'solid' : 'hidden')
                .style('border-top-style', d => d.centerAngle <= 135 & d.centerAngle > 45 ? 'solid' : 'hidden')
                .style('text-align', d => {
                    if ((d.centerAngle <= 0 & d.centerAngle > -45) || (d.centerAngle <= 45 & d.centerAngle > 0)) {
                        return 'center'
                    }
                    if (d.centerAngle <= -45 & d.centerAngle > -135) {
                        return 'center'
                    }
                    if ((d.centerAngle <= -135 & d.centerAngle >= -180) || (d.centerAngle <= 180 & d.centerAngle > 135)) {
                        return 'center'
                    }
                    if (d.centerAngle <= 135 & d.centerAngle > 45) {
                        return 'center'
                    }
                })
                .style('transform-origin', d => {
                    // if ((d.centerAngle <= 0 & d.centerAngle > -45) || (d.centerAngle <= 45 & d.centerAngle > 0)) {
                    //     return `left`
                    // }
                    // if (d.centerAngle <= -45 & d.centerAngle > -135) {
                    //     return `bottom center`
                    // }
                    // if ((d.centerAngle <= -135 & d.centerAngle >= -180) || (d.centerAngle <= 180 & d.centerAngle > 135)) {
                    //     return `right`
                    // }
                    // if (d.centerAngle <= 135 & d.centerAngle > 45) {
                    //     return `top center`
                    // }
                    if (d.centerAngle > 0 & d.centerAngle <= 90) {
                        return 'top center'
                    }
                    if (d.centerAngle > -90 & d.centerAngle <= 0) {
                        return 'bottom center'
                    }
                    if (d.centerAngle > 90 & d.centerAngle <= 180) {
                        return 'top center'
                    }
                    if (d.centerAngle > -180 & d.centerAngle <= -90) {
                        return 'bottom center'
                    }
                })
                .style('-webkit-transform', d => {
                    // if ((d.centerAngle <= 0 & d.centerAngle > -45) || (d.centerAngle <= 45 & d.centerAngle > 0)) {
                    //     return `rotate(${d.centerAngle}deg)`
                    // }
                    // if (d.centerAngle <= -45 & d.centerAngle > -135) {
                    //     return `rotate(${90 + d.centerAngle}deg)`
                    // }
                    // if ((d.centerAngle <= -135 & d.centerAngle >= -180) || (d.centerAngle <= 180 & d.centerAngle > 135)) {
                    //     return `rotate(${180 + d.centerAngle}deg)`
                    // }
                    // if (d.centerAngle <= 135 & d.centerAngle > 45) {
                    //     return `rotate(${270 + d.centerAngle}deg)`
                    // }
                    if (d.centerAngle > 0 & d.centerAngle <= 90) {
                        return `rotate(${270 + d.centerAngle}deg)`
                    }
                    if (d.centerAngle > -90 & d.centerAngle <= 0) {
                        return `rotate(${90 + d.centerAngle}deg)`
                    }
                    if (d.centerAngle > 90 & d.centerAngle <= 180) {
                        return `rotate(${-90 + d.centerAngle}deg)`
                    }
                    if (d.centerAngle > -180 & d.centerAngle <= -90) {
                        return `rotate(${-270 + d.centerAngle}deg)`
                    }
                })
        }
    }
}