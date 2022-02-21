d3.componentsTooltip = function d3ComponentsTooltip(params) {
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

    //innerFunctions which will update visuals
    let displayTooltip;
    let hideTooltip;

    //main chart object
    const main = function (selection) {
        selection.each(function scope() {

            // hide tooltip
            hideTooltip = function () {
                attrs.container.selectAll(".tooltipContent").remove();
            }

            //show tooltip
            displayTooltip = function () {

                // assign x and y positions
                let x = attrs.x;
                let y = attrs.y;

                //check container type first and transform if necessary
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

                //tooltip wrapper
                const tooltipWrapper = tooltipContentWrapper
                    .append("g")
                    .style("pointer-events", "none");

                //tooltip path
                tooltipWrapper.append("path");

                //row contents wrapper
                const g = tooltipWrapper.append("g");

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

                hoverContent.forEach(d => {
                    const row = content.append('tr')
                    row.append('td')
                        .classed('left-column', true)
                        .html(d.left)
                    row.append('td')
                        .classed('right-column', true)
                        .html(d.right)
                })

                //calculating positions
                const height = g.select('.hover-content-table-div').node().getBoundingClientRect().height
                const halfArrowLength = attrs.arrowLength / 2;
                const fullWidth = g.select('.hover-content-table-div').node().getBoundingClientRect().width;
                const halfWidth = fullWidth / 2;

                //building string paths
                const bottomArrowPos = ` L ${halfWidth - halfArrowLength}  ${height}  L ${halfWidth} ${height + attrs.arrowHeight}  L ${halfWidth + halfArrowLength} ${height}`
                const strPath = `M 0 0 L 0  ${height} ${bottomArrowPos} L ${fullWidth} ${height} L ${fullWidth} 0 L 0 0 `;

                // translate tooltip content based on configuration
                tooltipContentWrapper.attr("transform", `translate(${x},${y})`);

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

                //appending actual path
                tooltipWrapper
                    .select("path")
                    .attr("d", strPath)
                    .attr("fill", attrs.tooltipFill)
                    .attr('mask', 'url(#invisible)').raise();

                //final translation to match provided x and y position
                tooltipWrapper.attr(
                    "transform",
                    `translate(${-halfWidth},${-height - attrs.arrowHeight})`
                );

            }

        });
    };    

    //dinamic keys functions
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