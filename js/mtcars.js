d3.csv("/data/mtcars.csv", function(d) {
    return {
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
    
});
