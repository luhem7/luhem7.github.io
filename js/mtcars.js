d3.csv("/data/mtcars.csv", function(d) {
    return {
        make: d['model'].split(' ')[0],
        model : d.model,
        mpg : +d.mpg,
        cyl : +d.cyl,
        disp : +d.disp,
        hp : +d.hp,
        drat : +d.drat,
        wt : +d.wt,
        qsec : +d.qsec,
        vs : +d.vs,
        am : +d.am,
        gear : +d.gear,
        carb : +d.carb
    };
}).then(function(cars_array) {
    cars_array.columns.unshift('make');
    console.log(cars_array.columns);

    // ## Raw data in tabular format
    var raw_data_table = d3.select("#raw_data_table")
        .append("table");
    
    var table_header_row = raw_data_table.append('tr')
        .selectAll('tr')
        .data(cars_array.columns).enter()
            .append('th')
            .text(function (d) {return d;});
    
    
    var table_body_rows = raw_data_table
        .selectAll('tr')
        .data(cars_array).enter()
            .append('tr')
            .each(function(d, i, nodes){
                curr_row = d3.select(nodes[i])
                cars_array.columns.forEach(function (car_attr, index){
                    curr_row.append('td').text(d[car_attr]);
                })
            })
    
    // ## Scatterplot of the data along selected attributes
    var margin = {top: 20, right: 150, bottom: 20, left: 30},
        width = 650 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;
    
    var disp_max = 500;
    var mpg_max = 40;
    var hp_max = 350;

    // setup x 
    var xValue = function(d) { return d['hp'];}, // data -> value
        xScale = d3.scaleLinear().domain([0, hp_max]).range([0, width]), // value -> display
        xMap = function(d) { return xScale(xValue(d));}, // data -> display
        xAxis = d3.axisBottom(xScale);

    // setup y
    var yValue = function(d) { return d["mpg"];}, // data -> value
        yScale = d3.scaleLinear().domain([0, mpg_max]).range([height, 0]), // value -> display
        yMap = function(d) { return yScale(yValue(d));}, // data -> display
        yAxis = d3.axisLeft(yScale);
    
    // setup fill color
    var cValue = function(d) { return d['cyl'];},
        color = d3.scaleOrdinal(d3.schemeSet1);

    // add the graph canvas to the body of the webpage
    var scatter_canvas = d3.select('#scatterplot').text('')
        .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    
    // x-axis
    scatter_canvas.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis)
        .append("text")
            .attr("class", "label")
            .attr("x", width)
            .attr("y", -6)
            .style("text-anchor", "end")
            .text("HP");
    
    // y-axis
    scatter_canvas.append("g")
            .attr("class", "y axis")
            .call(yAxis)
    .append("text")
            .attr("class", "label")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("MPG");

    // draw dots
    scatter_canvas.selectAll(".dot")
        .data(cars_array)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("r", 3.5)
        .attr("cx", xMap)
        .attr("cy", yMap)
        .style("fill", function(d) { return color(cValue(d));})
            .append('text').text(function (d) {return d['hp'] + ', ' + d['mpg']; } );
            
    // draw legend
    var legend = scatter_canvas.selectAll(".legend")
        .data(color.domain())
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", function(d, i) { return "translate(100," + i * 20 + ")"; });

    // draw legend colored rectangles
    legend.append("rect")
        .attr("x", width - 18)
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", color);

    // draw legend text
    legend.append("text")
        .attr("x", width - 24)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "end")
        .text(function(d) { return d;})
});
