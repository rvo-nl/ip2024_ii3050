let sankeyData = {links: [],nodes: [],order: []}
let sankeyLayout
let sankeyDiagram
let activeScenario = 0
let scaleInit = 1
let sankeyCanvas
let headerCanvas
let footerCanvas
let autoPlayStatus = false
let autoPlayTimer
let zoomHasInitialized = false
let nodesGlobal
let helicopterMarkers = []
let globalScaleInit
let currentK = 1
let helicopterLabelsPreviousValues = {}
let initScenarioSwitchFlag = 2

let urlIP2024PDF = 'https://www.netbeheernederland.nl/_upload/RadFiles/New/Documents/Netbeheer_NL_Scenarios_IP2024_v1.01_final%20(1).pdf'
let urlII3050PDF = "https://www.netbeheernederland.nl/_upload/Files/Rapport_II3050_Scenario's_277.pdf"

setTimeout(() => {
  sankeyfy({
    mode: 'xlsx',
    xlsxURL: 'data/data.xlsx',
    targetDIV: 'mainContainer',
    margins: {vertical: 120,horizontal: 200},
    sankeyData: null,
    legend: null,
    settings: null
  })
}, 100)

function sankeyfy (config) {
  switch (config.mode) {
    case 'xlsx':
      process_xlsx(config)
      break
    case 'object':
      process_object(config)
      break
    default:
      console.log('WARNING - unknown plot mode')
      break
  }

  function process_xlsx (config) {
    console.log('sankeyfy - XLSX mode')
    readExcelFile(config.xlsxURL, (links, nodes, legend, settings) => {
      console.log('Links:', links)
      console.log('Nodes:', nodes)
      console.log('Legend:', legend)
      console.log('Settings:', settings)

      nodesGlobal = nodes

      config.settings = settings
      config.legend = legend

      globalScaleInit = settings[0].scaleInit

      console.log(nodes)
      let scaleValues = settings[0].scaleDataValue
      for (i = 0;i < links.length;i++) {
        Object.keys(links[i]).forEach(key => {
          if (typeof links[i][key] == 'number') {
            links[i][key] = links[i][key] / scaleValues
          }
        })
      }

      let maxColumn = 0
      // generate order object
      nodes.forEach(element => {
        if (element.column > maxColumn) {maxColumn = element.column}
      })
      let columnLength = maxColumn + 1
      for (i = 0;i < columnLength;i++) {
        sankeyData.order.push([[]])
      }
      for (i = 0;i < nodes.length;i++) {
        for (j = 0;j < sankeyData.order.length;j++) {
          if (nodes[i].column == j) {
            if (sankeyData.order[j].length == 0) {sankeyData.order[j].push([])}
            for (k = 0; k < nodes[i].cluster;k++) {
              if (!(sankeyData.order[j].includes(k))) {
                sankeyData.order[j].push([])
              }
            }
            if (sankeyData.order[j][nodes[i].cluster].length == 0) {sankeyData.order[j][nodes[i].cluster].push([])}
            for (k = 0;k < nodes[i].row;k++) {
              if (!(sankeyData.order[j][nodes[i].cluster].includes(k))) {
                sankeyData.order[j][nodes[i].cluster].push([])
              }
            }
            sankeyData.order[j][nodes[i].cluster][nodes[i].row].push(nodes[i].id)
          }
        }
      }
      // generate nodes object
      for (i = 0;i < nodes.length;i++) {
        sankeyData.nodes.push({title: nodes[i].title, id: nodes[i].id, direction: nodes[i].direction, index: i, dummy: nodes[i].dummy, x: nodes[i].x, y: nodes[i].y})
      }

      // generate scenario object
      let scenarios = []
      let counter = 0
      for (s = 0;s < Object.keys(links[0]).length;s++) {
        if (Object.keys(links[0])[s].includes('scenario')) {
          if (counter < 10) {
            scenarios.push({title: Object.keys(links[0])[s].slice(10), id: Object.keys(links[0])[s]}) // NOTE: maximum number of allowed scenarios is 100 in this setup
          }else {
            scenarios.push({title: Object.keys(links[0])[s].slice(11), id: Object.keys(links[0])[s]})
          }
          counter++
        }
      }

      config.scenarios = scenarios
      // generate links object
      for (i = 0;i < links.length;i++) {
        sankeyData.links.push({index: i, source: links[i]['source.id'], target: links[i]['target.id'], color: getColor(links[i]['legend'], legend), value: links[i].value, type: links[i].type, legend: links[i]['legend']})
        scenarios.forEach(element => {
          sankeyData.links[i][element.id] = links[i][element.id]
        })
      }

      adaptTotalHeight = config.settings[0].adaptTotalHeight

      let width = document.getElementById(config.targetDIV).offsetWidth
      let height = document.getElementById(config.targetDIV).offsetHeight

      sankeyLayout = d3.sankey().extent([[settings[0].horizontalMargin, settings[0].verticalMargin], [width - settings[0].horizontalMargin, height - settings[0].verticalMargin]])
      sankeyDiagram = d3.sankeyDiagram().nodeTitle(function (d) { return d.title }).linkColor(function (d) { return d.color }) // return d.title || d.id

      drawSankey(sankeyData, legend, config)
    })
  }

  function process_object (config) {
    console.log('sankeyfy - OBJECT mode')

    sankeyData = config.sankeyData

    sankeyLayout = d3.sankey().extent([[config.margins.horizontal, config.margins.vertical], [width - config.margins.horizontal, height - config.margins.vertical]])
    sankeyDiagram = d3.sankeyDiagram().nodeTitle(function (d) { return d.title }).linkColor(function (d) { return d.color }) // return d.title || d.id

    drawSankey(config, config.sankeyData, config.legend)
  }

  function drawSankey (sankeyData, legend, config) {
    d3.select('#sankeySVG').remove()

    assetslog = {}

    let scrollExtentWidth = config.settings[0].scrollExtentWidth
    let scrollExtentHeight = config.settings[0].scrollExtentHeight

    let viewportWidth = document.getElementById(config.targetDIV).offsetWidth
    let viewportHeight = document.getElementById(config.targetDIV).offsetHeight

    // create DIV structure
    // header
    d3.select('#' + config.targetDIV).append('div').attr('id', config.targetDIV + '_header').attr('class', 'header').style('position', 'absolute').style('top', '0px').style('left', '0px').style('right', '0px').style('overflow', 'hidden').style('height', '40px').style('width', '100%').append('svg').attr('id', config.targetDIV + '_headerSVG').attr('width', viewportWidth).attr('height', 40)
    // content wrapper
    d3.select('#' + config.targetDIV).append('div').attr('id', config.targetDIV + '_content-wrapper').style('position', 'relative').style('top', '90px').style('left', '0px').style('overflow', 'hidden').style('width', '100%').style('height', 'calc(100% - 130px)')
    // content
    d3.select('#' + config.targetDIV + '_content-wrapper').append('div').attr('id', 'content').style('width', viewportWidth + 'px').style('min-height', 'calc(100% - 130px)').style('height', viewportHeight + 'px').style('background-color', '')
    // footer
    d3.select('#' + config.targetDIV).append('div').attr('id', config.targetDIV + '_footer').attr('class', 'footer').style('height', '40px').style('width', '100%').style('position', 'absolute').style('bottom', '0px').style('left', '0px').style('overflow', 'hidden').append('svg').attr('id', config.targetDIV + '_footerSVG').attr('width', viewportWidth).attr('height', 40)
    // button
    d3.select('#' + config.targetDIV).append('div').attr('id', config.targetDIV + '_buttons').attr('class', 'buttons').style('height', '110px').style('width', '100%').style('position', 'absolute').style('top', '40px').style('left', '0px').style('overflow', 'hidden').append('svg').attr('id', config.targetDIV + '_buttonsSVG').attr('width', viewportWidth).attr('height', 110).style('background-color', 'none')
    // append SVGS
    d3.select('#content').append('svg').style('position', 'absolute').style('top', '0px').style('left', '0px').attr('id', 'sankeySVGbackdrop').attr('width', viewportWidth + 'px').attr('height', viewportHeight + 'px').style('pointer-events', 'none')
    d3.select('#content').append('svg').style('position', 'absolute').attr('id', 'sankeySVGPARENT').attr('width', scrollExtentWidth + 'px').attr('height', scrollExtentHeight + 'px').style('pointer-events', 'none').append('g').attr('id', 'sankeySVG').style('pointer-events', 'all') // scrollExtentWidth

    // append scenarioSummary container
    d3.select('#' + config.targetDIV).append('div').attr('class', 'scenarioSummary').style('position', 'absolute').style('left', '10px').style('top', '170px').style('width', '400px').style('background-color', 'rgba(255,255,255,0.8)').attr('id', 'scenarioSummaryContainer').style('pointer-events', 'none').style('visibility', 'hidden')

    // append huidgGetoond
    d3.select('#' + config.targetDIV).append('div').style('position', 'absolute').style('left', '10px').style('bottom', '50px').style('height', '21px').style('background-color', '#999').attr('id', 'huidigGetoond').style('pointer-events', 'none')

    // d3.select('#sankeySVG').style('transform-origin', '0px 0px')
    backdropCanvas = d3.select('#sankeySVGbackdrop')
    sankeyCanvas = d3.select('#sankeySVG')
    headerCanvas = d3.select('#' + config.targetDIV + '_headerSVG').append('g')
    footerCanvas = d3.select('#' + config.targetDIV + '_footerSVG').append('g')
    buttonsCanvas = d3.select('#' + config.targetDIV + '_buttonsSVG').append('g')
    parentCanvas = d3.select('#sankeySVGPARENT').append('g')

    sankeyCanvas.append('rect').attr('width', scrollExtentWidth).attr('height', scrollExtentHeight).attr('fill', '#ddd').style('opacity', 0.001)
    backdropCanvas.append('rect').attr('id', 'backDropCanvasFill').attr('width', scrollExtentWidth).attr('height', scrollExtentHeight).attr('fill', '#ddd').attr('fill', 'url(#dots)')

    window.addEventListener('resize', function (event) {
      d3.select('#backDropCanvasFill').attr('width', document.getElementById(config.targetDIV).offsetWidth).attr('height', document.getElementById(config.targetDIV).offsetWidth)
      d3.select('#sankeySVGbackdrop').attr('width', document.getElementById(config.targetDIV).offsetWidth).attr('height', document.getElementById(config.targetDIV).offsetWidth)
      d3.select('#' + config.targetDIV + '_buttonsSVG').attr('width', document.getElementById(config.targetDIV).offsetWidth)
    })

    parentCanvas.append('rect').attr('id', 'popupBlinder').attr('width', scrollExtentWidth).attr('height', scrollExtentHeight).attr('fill', '#333').style('opacity', 0.5).style('visibility', 'hidden').style('pointer-events', 'all')
      .on('click', function () {
        d3.select('#nodeInfoPopup').remove()
        d3.select('#popupBlinder').style('visibility', 'hidden')
        d3.select('#popupBlinder').style('pointer-events', 'none')
      })

    setTimeout(() => {
      introPopup()
    }, 500)
    function introPopup () {
      d3.select('#popupBlinder').style('visibility', 'visible').style('opacity', 0).transition().duration(300).style('opacity', 0.3)
      d3.select('#popupBlinder').style('pointer-events', 'all')
      d3.select('#' + config.targetDIV)
        // parent div 
        .append('div')
        .attr('id', 'introPopupParent')
        .style('pointer-events', 'none')
        .style('position', 'absolute').style('top', '40px').style('left', '0px').style('width', '100%').style('height', '100%').style('display', 'flex').style('justify-content', 'center').style('align-items', 'center')
        // child div
        .append('div')
        .style('pointer-events', 'all')
        .attr('id', 'introPopup')
        .style('position', 'absolute')
        .style('box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
        .style('-webkit-box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
        .style('-moz-box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
        .style('margin', 'auto') // centers div
        .style('width', '800px')
        .style('height', '640px')
        .style('background-color', 'rgba(255,255,255,1)')

      d3.select('#introPopup').append('svg').style('position', 'absolute').style('width', '100%').style('height', '100%').attr('id', 'introPopupSVG_main').style('top', '0px').style('left', '0px')
      // d3.select('#flowAnalysisPopup').append('svg').style('position', 'relative').style('top', '70px').style('left', '20px').style('width', '1000px').style('height', '340px').attr('id', 'flowAnalysisSVG_incoming').attr('transform', 'translate(0,0)')
      // d3.select('#flowAnalysisPopup').append('svg').style('position', 'relative').style('width', '100%').style('top', '20px').style('left', '20px').style('height', '340px').attr('id', 'flowAnalysisSVG_outgoing').attr('transform', 'translate(0,0)')

      let canvas = d3.select('#introPopupSVG_main').append('g')

      canvas.append('rect')
        .attr('x', 755).attr('y', 15)
        .attr('width', 30)
        .attr('height', 30)
        .attr('fill', '#FFF')
        .style('pointer-events', 'all')
        .on('mouseover', function () {
          d3.select(this).attr('fill', '#999')
          d3.select('#' + config.targetDIV + '_closeButton').attr('fill', '#fff')
        })
        .on('mouseout', function () {
          d3.select(this).attr('fill', '#fff')
          d3.select('#' + config.targetDIV + '_closeButton').attr('fill', '#000')
        })
        .on('click', function () {
          d3.select('#introPopup').remove()
          d3.select('#popupBlinder').style('visibility', 'hidden')
          d3.selectAll('#popupBlinder').style('pointer-events', 'none')
        })
      canvas.append('path').style('pointer-events', 'none').attr('id', config.targetDIV + '_closeButton').attr('d', 'm249 849-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z').attr('transform', 'translate(750,7)scale(0.04)')

      canvas.append('image')
        .attr('xlink:href', 'img/intro.png')
        .attr('width', 360) // Set the width of the image
        .attr('height', 360) // Set the height of the image
        .attr('x', 80) // Set the x-coordinate of the image
        .attr('y', 230); // Set the y-coordinate of the image

      canvas.append('text').style('font-size', '12px').text("Dit interactieve diagram visualiseert de IP2024- en II3050-scenario's van de netbeheerders. De scenario's vertegenwoordigen diverse mogelijke ontwikkelingsrichtingen voor het integrale energiesysteem in Nederland. De scenario's zijn opgesteld door de netbeheerders met input van belanghebbenden.").call(wrap, 600).attr('transform', 'translate(70,130)')

      canvas.append('text').style('font-size', '12px').text('Download de bijbehorende rapportages:').call(wrap, 600).attr('transform', 'translate(70,220)')

      canvas.append('text').style('pointer-events', 'all').style('font-size', '12px').text('IP2024').call(wrap, 600).attr('transform', 'translate(330,220)')
        .on('click', function () {
          window.open(urlIP2024PDF, 'tabs=yes,location=yes,height=570,width=740,scrollbars=yes,status=yes')
        }).style('text-decoration', 'underline').attr('fill', 'blue')
        .on('mouseover', function () {d3.select(this).style('cursor', 'pointer')})
        .on('mouseout', function () {d3.select(this).style('cursor', 'default')})

      canvas.append('text').style('pointer-events', 'all').style('font-size', '12px').text('II3050').call(wrap, 600).attr('transform', 'translate(390,220)')
        .on('click', function () {
          window.open(urlII3050PDF, 'tabs=yes,location=yes,height=570,width=740,scrollbars=yes,status=yes')
        }).style('text-decoration', 'underline').attr('fill', 'blue')
        .on('mouseover', function () {d3.select(this).style('cursor', 'pointer')})
        .on('mouseout', function () {d3.select(this).style('cursor', 'default')})

      canvas.append('text').style('font-size', '13px').text('Navigatie').style('font-weight', 600).call(wrap, 600).attr('transform', 'translate(500,255)')
      canvas.append('text').style('font-size', '11px').text("Schakel tussen de verschillende scenario's met gebruik van de knoppen bovenaan de pagina").call(wrap, 180).attr('transform', 'translate(500,290)')
      canvas.append('text').style('font-size', '11px').text("Klik op een energiestroom of op een knooppunt om alle scenario's onderling op dat punt te vergelijken.").call(wrap, 180).attr('transform', 'translate(500,400)')
      canvas.append('text').style('font-size', '11px').text('Navigeer het diagram met zoom en pan, scroll en sleep.').call(wrap, 180).attr('transform', 'translate(500,510)')
      canvas.append('text').style('font-size', '20px').text("Energiebalans IP2024 en II3050 scenario's").call(wrap, 500).attr('transform', 'translate(70,80)')

      canvas.append('rect').attr('width', 108).attr('height', 1).attr('x', 390).attr('y', 285).attr('fill', '#333')
      canvas.append('circle').attr('r', 21).attr('cx', 368).attr('cy', 287).attr('fill', 'none').style('stroke-width', 1).style('stroke', '#333')

      canvas.append('rect').attr('width', 108).attr('height', 1).attr('x', 390).attr('y', 395).attr('fill', '#333')
      canvas.append('circle').attr('r', 21).attr('cx', 368).attr('cy', 397).attr('fill', 'none').style('stroke-width', 1).style('stroke', '#333')

      canvas.append('rect').attr('width', 108).attr('height', 1).attr('x', 390).attr('y', 505).attr('fill', '#333')
      canvas.append('circle').attr('r', 21).attr('cx', 368).attr('cy', 507).attr('fill', 'none').style('stroke-width', 1).style('stroke', '#333')

      canvas.append('rect').attr('width', 100).attr('height', 35).attr('fill', 'white').style('stroke', '#333').style('stroke-width', 1).attr('x', 660).attr('y', 570).on('mouseover', function () {
        d3.select(this).attr('fill', '#999')
        d3.select('#' + config.targetDIV + '_okButton').attr('fill', '#fff')
      })
        .on('mouseout', function () {
          d3.select(this).attr('fill', '#fff')
          d3.select('#' + config.targetDIV + '_okButton').attr('fill', '#000')
        })
        .on('click', function () {
          d3.select('#introPopup').remove()
          d3.select('#popupBlinder').style('visibility', 'hidden')
          d3.selectAll('#popupBlinder').style('pointer-events', 'none')
        })
      canvas.append('text').attr('id', config.targetDIV + '_okButton').style('text-anchor', 'middle').attr('x', 710).attr('y', 593).style('pointer-events', 'none').text('OK')

      parentCanvas.append('rect').attr('id', 'popupBlinder').attr('width', scrollExtentWidth).attr('height', scrollExtentHeight).attr('fill', '#333').style('opacity', 0.5).style('visibility', 'hidden').style('pointer-events', 'all')
        .on('click', function () {
          d3.select('#introPopup').remove()
          d3.select('#popupBlinder').style('visibility', 'hidden')
          d3.selectAll('#popupBlinder').style('pointer-events', 'none')
        })
    }

    function zoomed ({ transform }) {
      // console.log(transform)
      const initX = parseFloat(config.settings[0].initTransformX)
      const initY = parseFloat(config.settings[0].initTransformY)
      const initK = parseFloat(config.settings[0].initTransformK)
      var adjustedTransform = d3.zoomIdentity.translate(initX + transform.x, initY + transform.y).scale(initK * transform.k)
      d3.select('#sankeySVG').attr('transform', adjustedTransform)

      // console.log(transform.k)
      for (i = 0;i < helicopterMarkers.length;i++) {
        d3.select('#' + helicopterMarkers[i].id + '_group').attr('transform', 'scale(' + 1 / transform.k + ')')
      }
      currentK = 1 / transform.k
    }

    function initZoom () {
      d3.select('#sankeySVGPARENT').call(d3.zoom()
        .extent([[0, 0], [document.getElementById('sankeySVGPARENT').getAttribute('width').slice(0, -2), document.getElementById('sankeySVGPARENT').getAttribute('height').slice(0, -2)]])
        .scaleExtent([0.5, 8])
        .on('zoom', zoomed)
      )
      const initX = parseFloat(config.settings[0].initTransformX)
      const initY = parseFloat(config.settings[0].initTransformY)
      const initK = parseFloat(config.settings[0].initTransformK)
      var initTransform = d3.zoomIdentity.translate(initX, initY).scale(initK)
      console.log(initTransform)
      // zoomed(initTransform)
      d3.select('#sankeySVG').attr('transform', initTransform)
    }

    initZoom()

    d3.select('.sankey').select('.links').selectAll('.link').attr('id', function (d) {console.log(d)})

    // draw scenario buttons
    let spacing = 7
    let cumulativeXpos = 45

    if (config.settings[0].scenarioButtons == 'ja') {
      // ------------------ draw custom scenario selection menu

      buttonsCanvas.append('rect').attr('width', 5000).attr('height', 55).attr('fill', '#DDD').attr('x', 0).attr('y', 0)
      buttonsCanvas.append('rect').attr('width', 5000).attr('height', 55).attr('fill', '#CCC').attr('x', 0).attr('y', 55)
      // buttonsCanvas.append('rect').attr('width', 3000).attr('height', 1).attr('fill', '#333').attr('x', 30).attr('y', 55)
      buttonsCanvas.append('rect').attr('width', 5000).attr('height', 1).attr('fill', '#333').attr('x', 0).attr('y', 109)

      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 15 + 60).attr('y', 35).style('font-weight', 300).style('font-weight', 500).style('font-size', '14px').text('IP2024')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 15 + 60).attr('y', 35 + 55).style('font-weight', 500).style('font-size', '14px').text('II3050')

      let rdx = 0
      let hooverColor = '#EEE'
      let defaultColor = '#FFF'

      // IP2024 KA KLIMAAT AMBITIE SCENARIO SELECTIE BUTTONS
      buttonsCanvas.append('text').style('font-weight', 600).style('text-anchor', 'end').attr('x', 170).attr('y', 21).style('font-size', '13px').text('KA')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 170).attr('y', 33).style('font-size', '10px').text('klimaat')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 170).attr('y', 45).style('font-size', '10px').text('ambitie')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 185).attr('y', 8).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 0 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[0].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden'); d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 205).attr('y', 33).style('font-size', '12px').style('font-weight', 500).text('2025')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 0 + '_text')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 230).attr('y', 8).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 1 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer');showScenarioSummary(config.scenarios[1].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 250).attr('y', 33).style('font-size', '12px').style('font-weight', 500).text('2030')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 1 + '_text')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 275).attr('y', 8).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 2 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[2].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 296).attr('y', 33).style('font-size', '12px').style('font-weight', 500).text('2035')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 2 + '_text')

      // IP2024 ND NATIONALE DRIJFVEER SCENARIO SELECTIE BUTTONS
      buttonsCanvas.append('text').style('font-weight', 600).style('text-anchor', 'end').attr('x', 410).attr('y', 21).style('font-size', '13px').text('ND')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 410).attr('y', 33).style('font-size', '10px').text('nationale')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 410).attr('y', 45).style('font-size', '10px').text('drijfveren')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 425).attr('y', 8).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 3 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer');showScenarioSummary(config.scenarios[3].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 445).attr('y', 33).style('font-size', '12px').style('font-weight', 500).text('2025')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 3 + '_text')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 470).attr('y', 8).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 4 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer');showScenarioSummary(config.scenarios[4].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 490).attr('y', 33).style('font-size', '12px').style('font-weight', 500).text('2030')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 4 + '_text')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 515).attr('y', 8).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 5 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[5].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 536).attr('y', 33).style('font-size', '12px').style('font-weight', 500).text('2035')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 5 + '_text')

      // HIER
      // IP2024 IA INTERNATIONALE AMBITIE SCENARIO SELECTIE BUTTONS
      buttonsCanvas.append('text').style('font-weight', 600).style('text-anchor', 'end').attr('x', 650).attr('y', 21).style('font-size', '13px').text('IA')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 650).attr('y', 33).style('font-size', '10px').text('internationale')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 650).attr('y', 45).style('font-size', '10px').text('ambitie')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 665).attr('y', 8).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 6 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[6].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 685).attr('y', 33).style('font-size', '12px').style('font-weight', 500).text('2025')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 6 + '_text')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 710).attr('y', 8).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 7 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[7].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 730).attr('y', 33).style('font-size', '12px').style('font-weight', 500).text('2030')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 7 + '_text')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 755).attr('y', 8).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 8 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer');showScenarioSummary(config.scenarios[8].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 776).attr('y', 33).style('font-size', '12px').style('font-weight', 500).text('2035')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 8 + '_text')

      // II3050 DEC DECENTRALE INITIATIEVEN SCENARIO SELECTIE BUTTONS
      buttonsCanvas.append('text').style('font-weight', 600).style('text-anchor', 'end').attr('x', 170).attr('y', 75).style('font-size', '13px').text('DEC')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 170).attr('y', 87).style('font-size', '10px').text('decentrale')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 170).attr('y', 99).style('font-size', '10px').text('initiatieven')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 185).attr('y', 62).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 9 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[9].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 205).attr('y', 87).style('font-size', '12px').style('font-weight', 500).text('2040')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 9 + '_text')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 230).attr('y', 62).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 10 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[10].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 250).attr('y', 87).style('font-size', '12px').style('font-weight', 500).text('2050')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 10 + '_text')

      // II3050 NAT NATIONAAL LEIDERSCHAP SCENARIO SELECTIE BUTTONS
      buttonsCanvas.append('text').style('font-weight', 600).style('text-anchor', 'end').attr('x', 365).attr('y', 75).style('font-size', '13px').text('NAT')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 365).attr('y', 87).style('font-size', '10px').text('nationaal')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 365).attr('y', 99).style('font-size', '10px').text('leiderschap')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 380).attr('y', 61).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 11 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[11].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 400).attr('y', 87).style('font-size', '12px').style('font-weight', 500).text('2040')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 11 + '_text')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 425).attr('y', 62).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 12 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor);d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[12].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 445).attr('y', 87).style('font-size', '12px').style('font-weight', 500).text('2050')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 12 + '_text')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 470).attr('y', 61).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 13 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[13].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 490).attr('y', 79).style('font-size', '12px').style('font-weight', 500).text('2050')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 13 + '_text')
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 490).attr('y', 94).style('font-size', '12px').style('font-weight', 500).text('(zero)')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 13 + '_text')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 515).attr('y', 61).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 14 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[14].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 535).attr('y', 79).style('font-size', '12px').style('font-weight', 500).text('2050')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 14 + '_text')
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 535).attr('y', 95).style('font-size', '12px').style('font-weight', 500).text('(synf)')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 14 + '_text')

      // II30t50 EUR EUROPESE INTEGRATIE SCENARIO SELECTIE BUTTONS
      buttonsCanvas.append('text').style('font-weight', 600).style('text-anchor', 'end').attr('x', 650).attr('y', 75).style('font-size', '13px').text('EUR')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 650).attr('y', 87).style('font-size', '10px').text('Europese')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 650).attr('y', 99).style('font-size', '10px').text('integratie')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 665).attr('y', 61).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 15 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor);d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[15].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 685).attr('y', 87).style('font-size', '12px').style('font-weight', 500).text('2040')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 15 + '_text')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 710).attr('y', 62).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 16 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[16].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 730).attr('y', 87).style('font-size', '12px').style('font-weight', 500).text('2050')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 16 + '_text')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 755).attr('y', 62).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 17 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[17].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 775).attr('y', 79).style('font-size', '12px').style('font-weight', 500).text('2050')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 17 + '_text')
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 775).attr('y', 94).style('font-size', '12px').style('font-weight', 500).text('(zero)')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 17 + '_text')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 800).attr('y', 61).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 18 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[18].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 820).attr('y', 79).style('font-size', '12px').style('font-weight', 500).text('2050')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 18 + '_text')
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 820).attr('y', 95).style('font-size', '12px').style('font-weight', 500).text('(synf)')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 18 + '_text')
      // II3050 INT INTERNATIONALE HANDEL SCENARIO SELECTIE BUTTONS
      buttonsCanvas.append('text').style('font-weight', 600).style('text-anchor', 'end').attr('x', 930).attr('y', 75).style('font-size', '13px').text('INT')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 930).attr('y', 87).style('font-size', '10px').text('internationale')
      buttonsCanvas.append('text').style('text-anchor', 'end').attr('x', 930).attr('y', 99).style('font-size', '10px').text('handel')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 945).attr('y', 62).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 19 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[19].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 965).attr('y', 87).style('font-size', '12px').style('font-weight', 500).text('2040')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 19 + '_text')

      buttonsCanvas.append('rect').attr('width', 40).attr('height', 40).attr('fill', '#fff').attr('x', 990).attr('y', 62).attr('rx', rdx).attr('ry', rdx)
        .attr('class', 'buttonRect_' + config.targetDIV).attr('id', 'scenariobutton_' + 20 + '_rect')
        .on('mouseover', function () {d3.select(this).attr('fill', hooverColor); d3.select(this).style('cursor', 'pointer'); showScenarioSummary(config.scenarios[20].id);}).on('mouseout', function () {d3.select('#scenarioSummaryContainer').style('visibility', 'hidden');d3.select(this).style('cursor', 'default');d3.select(this).attr('fill', defaultColor); setScenario(activeScenario, 'soft')})
        .on('click', function () {muteHoover = true; d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff'); d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333');d3.select(this).transition().duration(200).attr('fill', '#333'); d3.select('#scenariobutton_' + this.id.slice(15, -5) + '_text').transition().duration(200).attr('fill', '#eee'); activeScenario = this.id.slice(15, -5); adaptTotalHeight = 300; tick(); updateActiveScenarioIndicator(activeScenario); })
      buttonsCanvas.append('text').style('text-anchor', 'middle').attr('x', 1010).attr('y', 87).style('font-size', '12px').style('font-weight', 500).text('2050')
        .attr('class', 'buttonText_' + config.targetDIV).attr('id', 'scenariobutton_' + 20 + '_text')

      function showScenarioSummary (selection, scenarios) {
        console.log(selection)

        switch (selection) {
          case 'scenario0_IP2024_KA_2025':
          case 'scenario1_IP2024_KA_2030':
          case 'scenario2_IP2024_KA_2035':
            d3.select('#scenarioSummaryContainer').style('visibility', 'visible').style('pointer-events', 'all')
            d3.select('#scenarioSummaryContainer').html('<h3>Scenario Klimaatambitie (KA)</h3> Centraal IP2024 scenario op basis van al het bestaande en het voorgenomen energie- en klimaatbeleid (Klimaat- en Energieverkenning 2022), aangevuld met de kabinetsambitie voor aanvullend geagendeerd beleid uit het Coalitieakkoord. <br>')
            break
          case 'scenario3_IP2024_ND_2025':
          case 'scenario4_IP2024_ND_2030':
          case 'scenario5_IP2024_ND_2035':
            d3.select('#scenarioSummaryContainer').style('visibility', 'visible').style('pointer-events', 'all')
            d3.select('#scenarioSummaryContainer').html('<h3>Scenario Nationale Drijfveren (ND)</h3> Flankerend IP2024 scenario dat ten opzichte van het Klimaatambitie scenario nóg sterker inzet op elektrificatie van de vraag en duurzame opwek op land. <br>')
            break
          case 'scenario6_IP2024_IA_2025':
          case 'scenario7_IP2024_IA_2030':
          case 'scenario8_IP2024_IA_2035':
            d3.select('#scenarioSummaryContainer').style('visibility', 'visible').style('pointer-events', 'all')
            d3.select('#scenarioSummaryContainer').html('<h3>Scenario Internationale Ambitie (IA)</h3> Flankerend IP2024 scenario dat ten opzichte van het Klimaatambitie scenario sterker inzet op duurzame gassen (moleculen). Naast directe elektrificatie wordt er meer ingezet op groen gas en waterstof. <br>')
            break
          case 'scenario9_II3050v2_DEC_2040':
          case 'scenario10_II3050v2_DEC_2050':
            d3.select('#scenarioSummaryContainer').style('visibility', 'visible').style('pointer-events', 'all')
            d3.select('#scenarioSummaryContainer').html('<h3>Decentrale Initiatieven (DEC)</h3>Nederland streeft naar regionale actie door de particuliere businesscase van klimaatneutrale technieken te ondersteunen. In de toekomst hebben burgers en lokale gemeenschappen veel autonomie en maken ze duurzame keuzes met ondersteuning van prikkels. Dit leidt tot talrijke lokale initiatieven, optimale benutting van lokale bronnen en groei van zonne- en windenergie. De industrie transformeert naar duurzame grondstoffen, maar een deel van de energie-intensieve basisindustrie verdwijnt door beperkte acceptatie van CCS en sturing. Warmteoplossingen in de gebouwde omgeving gebruiken diverse technieken en lokale bronnen, met minder nadruk op warmtenetten.<br>')
            break
          case 'scenario11_II3050v2_NAT_2040':
          case 'scenario12_II3050v2_NAT_2050':
          case 'scenario13_II3050v2_NAT_zero_2050':
          case 'scenario14_II3050v2_NAT_synfuels_2050':
            d3.select('#scenarioSummaryContainer').style('visibility', 'visible').style('pointer-events', 'all')
            d3.select('#scenarioSummaryContainer').html('<h3>Nationaal leiderschap (NAT)</h3> Nederland streeft naar een energetisch efficiënt systeem binnen de Nederlandse mogelijkheden en stuurt nationaal sterk op de invulling van de energiemix. De overheid voert verplichtend beleid en regulering, participeert financieel in nationale projecten en bevordert nieuwe industrieën en elektrificatie. In de gebouwde omgeving worden warmtenetten ontwikkeld, gevoed door restwarmte, geothermie en flexibele elektrische bronnen. Nationale projecten benutten wind op zee maximaal, implementeren enkele flexibele kerncentrales, terwijl groene waterstof een belangrijke rol speelt in het balanceren van het elektriciteitssysteem, levering van hogetemperatuurwarmte in de industrie en als grondstof.<br>')
            break
          case 'scenario15_II3050v2_EUR_2040':
          case 'scenario16_II3050v2_EUR_2050':
          case 'scenario17_II3050v2_EUR_zero_2050':
          case 'scenario18_II3050v2_EUR_synfuels_2050':
            d3.select('#scenarioSummaryContainer').style('visibility', 'visible').style('pointer-events', 'all')
            d3.select('#scenarioSummaryContainer').html('<h3>Europese integratie (EUR)</h3> Nederland streeft naar een integraal en efficiënt Europees energiesysteem: landen stemmen hun energiebeleid onderling af en maken daarbij gebruik van elkaars bronnen. Europa werkt aan een gezamenlijk energiebeleid voor meer onafhankelijkheid. Groen gas wordt breed gebruikt, terwijl zonne- en windenergie groeien en kernenergie tot 8 GW toeneemt. De industrie verduurzaamt door elektrificatie, Europese biomassa en waterstof. CCS wordt toegepast, ook voor negatieve emissie-energie en blauwe waterstof. Nederland slaat CO2 op en focust op wijkaanpakken en bovenregionale warmtenetten. Hybride warmtevoorziening en warmtenetten verminderen de piekvraag naar elektriciteit. Elektrificatie van mobiliteit wordt gestimuleerd met een Europees laadnetwerk en HSL-uitbreiding.<br>')
            break
          case 'scenario19_II3050v2_INT_2040':
          case 'scenario20_II3050v2_INT_2050':
            d3.select('#scenarioSummaryContainer').style('visibility', 'visible').style('pointer-events', 'all')
            d3.select('#scenarioSummaryContainer').html('<h3>Internationale Handel (INT)</h3>Nederland streeft naar ontwikkeling van de eigen economie door maximaal in te zetten op de internationale wereldwijde energie- en grondstoffenketens. Nederland maakt strategisch gebruik van internationale energie- en grondstoffenmarkten, met een focus op kostenefficiëntie en internationale vrijhandel. Ondersteunende prikkels, subsidies en CO2-beprijzing stimuleren duurzaamheid. Waterstof en andere klimaatneutrale energiedragers worden geïmporteerd, waardoor Nederland een doorvoerland voor waterstof wordt. In de gebouwde omgeving zijn individuele transitiepaden belangrijk, met minder nadruk op groen gas maar wel op hybride warmtevoorziening met waterstof. De industrie verduurzaamt door elektrificatie en waterstofgebruik, maar een deel van de energie-intensieve industrie verdwijnt naar het buitenland. Nederland importeert meer halffabricaten en produceert groene waterstof gekoppeld aan wind op zee, waardoor de eigen energieproductie minder nodig is vanwege hoge energie-import.<br>')
            break
          default:
            break
        }
      }

      function getWordFromIndex (str, index) {
        let words = str.split(' ')
        if (index >= 0 && index < words.length) {
          return words[index]
        }
      }
    }
    if (config.settings[0].normalize.toLowerCase() == 'nee') {
      scaleInit = config.settings[0].scaleInit
    } else scaleInit = null

    function setScenario (scenario, type) {
      d3.selectAll('.buttonRect_' + config.targetDIV).attr('fill', '#fff')
      d3.selectAll('.buttonText_' + config.targetDIV).attr('fill', '#333')
      d3.select('#scenariobutton_' + scenario + '_rect').attr('fill', '#333')
      d3.select('#scenariobutton_' + scenario + '_text').attr('fill', '#fff')
      activeScenario = scenario
      console.log(config)

      if (type != 'soft') {tick()}
    }

    function updateActiveScenarioIndicator (scenario) {
      let conceptNotificatie = '. NB: Dit is een conceptversie, het diagram kan nog inconsistenties bevatten.'
      let scenarioTitles = {
        IP2024_KA_2025: 'Getoond: IP2024 - Klimaat Ambitie (KA) - 2025' + conceptNotificatie,
        IP2024_KA_2030: 'Getoond: IP2024 - Klimaat Ambitie (KA) - 2030',
        IP2024_KA_2035: 'Getoond: IP2024 - Klimaat Ambitie (KA) - 2035',
        IP2024_ND_2025: 'Getoond: IP2024 - Nationale Drijfveer (ND) - 2025',
        IP2024_ND_2030: 'Getoond: IP2024 - Nationale Drijfveer (ND) - 2030',
        IP2024_ND_2035: 'Getoond: IP2024 - Nationale Drijfveer (ND) - 2035',
        IP2024_IA_2025: 'Getoond: IP2024 - Internationale Ambitie (IA) - 2025',
        IP2024_IA_2030: 'Getoond: IP2024 - Internationale Ambitie (IA) - 2030',
        IP2024_IA_2035: 'Getoond: IP2024 - Internationale Ambitie (IA) - 2035',
        II3050v2_DEC_2040: 'Getoond: II3050 V2 - Decentrale Initiatieven (DEC) - 2040',
        II3050v2_DEC_2050: 'Getoond: II3050 V2 - Decentrale Initiatieven (DEC) - 2050',
        II3050v2_NAT_2040: 'Getoond: II3050 V2 - Nationaal Leiderschap (NAT) - 2040',
        II3050v2_NAT_2050: 'Getoond: II3050 V2 - Nationaal Leiderschap (NAT) - 2050',
        II3050v2_NAT_zero_2050: 'Getoond: II3050 V2 - Nationaal Leiderschap (NAT) - 2050 - Zero',
        II3050v2_NAT_synfuels_2050: 'Getoond: II3050 V2 - Nationaal Leiderschap (NAT) - 2050 - Synfuels',
        II3050v2_EUR_2040: 'Getoond: II3050 V2 - Europese Integratie (EUR) - 2040',
        II3050v2_EUR_2050: 'Getoond: II3050 V2 - Europese Integratie (EUR) - 2050',
        II3050v2_EUR_zero_2050: 'Getoond: II3050 V2 - Europese Integratie (EUR) - 2050 - Zero',
        II3050v2_EUR_synfuels_2050: 'Getoond: II3050 V2 - Europese Integratie (EUR) - 2050 - Synfuels',
        II3050v2_INT_2040: 'Getoond: II3050 V2 - Internationale Handel (INT) - 2040',
        II3050v2_INT_2050: 'Getoond: II3050 V2 - Internationale Handel (INT) - 2050'
      }
      d3.select('#huidigGetoond').html(scenarioTitles[config.scenarios[activeScenario].title])
    }

    // init
    setScenario(config.settings[0].defaultScenario)
    updateActiveScenarioIndicator(activeScenario)

    headerCanvas.append('text').attr('fill', 'white').style('font-family', config.settings[0].fontFamily).style('font-size', 15 + 'px').attr('x', config.settings[0].titlePositionX).attr('y', config.settings[0].titlePositionY).text(config.settings[0].title)

    drawSankeyLegend(legend)
    function drawSankeyLegend () {
      let shiftY = config.settings[0].legendPositionTop
      let shiftX = config.settings[0].legendPositionLeft
      let box = 15
      let spacing = 35

      let legendEntries = []
      for (i = 0;i < legend.length;i++) {
        legendEntries.push({label: legend[i].id, color: legend[i].color, width: getTextWidth(legend[i].id, '13px', config.settings[0].font) + box + spacing})
      }

      let cumulativeWidth = 0
      for (i = 0; i < legendEntries.length; i++) {
        footerCanvas.append('rect').attr('x', cumulativeWidth + shiftX).attr('y', shiftY).attr('width', box).attr('height', box).attr('fill', legendEntries[i].color)
        footerCanvas.append('text').style('font-family', config.settings[0].fontFamily).attr('x', cumulativeWidth + shiftX + 25).attr('y', shiftY + box / 1.4).style('font-size', 12 + 'px').text(legendEntries[i].label)
        cumulativeWidth += legendEntries[i].width
      }
    }
  }
  let indicatorTimeOut
  function drawHelicopterMarkers (attributes) {
    let showDuration = 4000
    index = nodesGlobal.findIndex(item => item.id === attributes.id)
    attributes.value = Math.round(d3.select('#nodeindex_' + index).attr('height') / globalScaleInit)
    attributes.refX = nodesGlobal[index].x - 300
    attributes.refY = nodesGlobal[index].y - 1000
    helicopterMarkers.push(attributes)

    let icon = 'm480-123.807-252.769-252.77 20.384-21.538L465.346-180.5v-663.385h30.193V-180.5l216.846-218.115 21.269 22.038L480-123.807Z'

    sankeyCanvas.append('g').attr('id', attributes.id + '_group').attr('class', 'helicopterLabel')
    let group = d3.select('#' + attributes.id + '_group')

    let posx = 250 + attributes.refX
    let posy = 1100 + attributes.refY

    group.style('transform-origin', posx + 'px ' + posy + 'px')

    d3.select('#' + attributes.id + '_group').attr('transform', 'scale(' + currentK + ')')

    posx = 178 + attributes.refX
    posy = 1100 + attributes.refY

    let titleLabelWidth = getTextWidth(attributes.title, '60px', config.settings[0].font) * 0.96 + 60
    let valueLabelWidth = getTextWidth(attributes.value + ' PJ', '60px', config.settings[0].font) * 0.96 + 60
    group.append('path').attr('d', icon).attr('transform', 'translate(' + posx + ',' + posy + ')scale(0.15)')

    group.append('rect').attr('x', - titleLabelWidth + 260 + 10 + attributes.refX).attr('y', 850 + attributes.refY).attr('width', titleLabelWidth).attr('height', 95).attr('fill', 'white').style('opacity', 1)
    group.append('text').attr('x', 240 + attributes.refX).attr('y', 920 + attributes.refY).attr('fill', '#000').style('font-size', '60px').style('text-anchor', 'end').style('font-weight', '400').text(attributes.title)

    group.append('rect').attr('x', 270 + attributes.refX).attr('y', 850 + attributes.refY).attr('width', valueLabelWidth).attr('height', 95).attr('fill', '#333').style('opacity', 0.6)
    group.append('text').attr('x', 290 + attributes.refX).attr('y', 920 + attributes.refY).attr('fill', '#FFF').style('font-size', '60px').style('text-anchor', 'start').text(attributes.value + ' PJ')

    if (initScenarioSwitchFlag == 0) {
      clearTimeout(indicatorTimeOut)
      console.log(helicopterLabelsPreviousValues[attributes.id])

      posx = attributes.refX - titleLabelWidth - 110
      posy = 970 + attributes.refY
      // group.append('rect').attr('x', attributes.refX - titleLabelWidth + 50 - 95 - 40).attr('y', 850 + attributes.refY).attr('width', 95).attr('height', 95).attr('fill', '#333').style('opacity', 0.6).style('visibility', 'visible').attr('id', 'changeIndicator').transition().duration(showDuration).style('opacity', 0)
      let change = 0
      if (helicopterLabelsPreviousValues[attributes.id] < attributes.value) {
        // group.append('path').attr('d', up).attr('transform', 'translate(' + posx + ',' + posy + ')scale(0.15)').attr('fill', '#FFF').style('visibility', 'visible').attr('id', 'changeIndicator').transition().duration(showDuration).style('opacity', 0)
        let diff = attributes.value - helicopterLabelsPreviousValues[attributes.id]
        change = '+ ' + diff + ' PJ'
      }
      if (helicopterLabelsPreviousValues[attributes.id] > attributes.value) {
        // group.append('path').attr('d', down).attr('transform', 'translate(' + posx + ',' + posy + ')scale(0.15)').attr('fill', '#FFF').style('visibility', 'visible').attr('id', 'changeIndicator').transition().duration(showDuration).style('opacity', 0)
        // console.log()
        let diff = helicopterLabelsPreviousValues[attributes.id] - attributes.value
        change = '- ' + diff + ' PJ'
      }
      // group.append('rect').attr('x', attributes.refX).attr('y', 850 + attributes.refY + 90).attr('width', 250 * 0.8).attr('height', 95 * 0.8).attr('fill', 'black').style('opacity', 0.6).style('visibility', 'visible').attr('id', 'changeIndicator').transition().duration(showDuration).style('opacity', 0)
      group.append('text').attr('x', attributes.refX + 200).attr('y', 920 + attributes.refY + 90 + 40).attr('fill', '#000').style('font-size', '70px').style('text-anchor', 'end').text(change).style('visibility', 'visible').attr('id', 'changeIndicator').transition().duration(showDuration).style('opacity', 0)
      indicatorTimeOut = setTimeout(() => {
        d3.selectAll('#changeIndicator').remove()
      }, showDuration)
    }
    helicopterLabelsPreviousValues[attributes.id] = attributes.value
  }

  function updateSankey (json, offsetX, offsetY, fontSize, fontFamily) {
    try {
      var json = JSON.parse(json)
      d3.select('#error').text('')
    } catch (e) { d3.select('#error').text(e); return; }
    sankeyLayout.nodePosition(function (node) {
      return [node.x, node.y]
    })

    let duration = 500

    d3.select('#sankeySVG').datum(sankeyLayout.scale(scaleInit)(json)).transition().duration(duration).ease(d3.easeLinear).call(sankeyDiagram)
    d3.select('.sankey').attr('transform', 'translate(' + offsetX + ',' + offsetY + ')')
    d3.selectAll('.node-title').style('font-size', fontSize + 'tepx')
    d3.selectAll('.link').style('pointer-events', 'all')
    d3.selectAll('.node').style('pointer-events', 'all')
    d3.selectAll('.node-backdrop-title').style('pointer-events', 'none') // otherwise nodevalue text gets in the way of mouseclick 
    d3.selectAll('.node-click-target').style('fill', '#555').style('stroke-width', 0).attr('width', 10).attr('rx', 0).attr('ry', 0).attr('transform', 'translate(-4,0)scale(1.005)')
    // attach id's to link paths
    d3.select('.sankey').select('.links').selectAll('.link').select('path').attr('id', function (d, i) { return 'linkindex_' + d.index}).on('click', function () { drawBarGraph(sankeyData.links[this.id.slice(10)], config) })
    // attach id's to node rects
    d3.select('.sankey').select('.nodes').selectAll('.node').select('.node-click-target').attr('id', function (d, i) {return 'nodeindex_' + d.index}).on('click', function () { nodeVisualisatieSingular(config, sankeyData.nodes[this.id.slice(10)], sankeyData, config.scenarios, config.targetDIV) })

    setTimeout(() => {
      helicopterMarkers = []
      d3.selectAll('.helicopterLabel').remove()
      drawHelicopterMarkers({id: 'hernieuwbaar_totaal', title: 'HERNIEUWBAAR',change: 30, color: '#1DE9B6'})
      drawHelicopterMarkers({id: 'elektriciteit_totaldemand', title: 'ELEKTRICITEIT', change: 30, color: '#FFB300'})
      drawHelicopterMarkers({id: 'heat_totaldemand', title: 'WARMTE', change: 30, color: '#F44336'})
      drawHelicopterMarkers({id: 'hydrogen_totaldemand', title: 'WATERSTOF', change: 30, color: '#3c39cc'})
      drawHelicopterMarkers({id: 'nat_gas_totalsupply', title: 'METHAAN', change: 30, color: '#64B5F6'})
      drawHelicopterMarkers({id: 'crude_oil_totalsupply', title: 'AARDOLIE', change: 30, color: 'grey'})
      drawHelicopterMarkers({id: 'energievraag_tr_secundair', title: 'MOBILITEIT', change: 30, color: '#000000'})
      drawHelicopterMarkers({id: 'energievraag_ind_secundair', title: 'INDUSTRIE', change: 30, color: '#000000'})
      drawHelicopterMarkers({id: 'energievraag_go_secundair', title: 'HUISHOUDENS', change: 30, color: '#000000'})
      drawHelicopterMarkers({id: 'energievraag_bu_secundair', title: 'GEBOUWEN', change: 30, color: '#000000'})
      drawHelicopterMarkers({id: 'energievraag_ag_secundair', title: 'LANDBOUW', change: 30, color: '#000000'})
      drawHelicopterMarkers({id: 'winning_totaal', title: 'WINNING', change: 30, color: '#000000'})
      drawHelicopterMarkers({id: 'import_totaal', title: 'IMPORT', change: 30, color: '#000000'})
      drawHelicopterMarkers({id: 'export_totaal', title: 'EXPORT', change: 30, color: '#000000'})

      if (initScenarioSwitchFlag > 0) { initScenarioSwitchFlag--}
    }, duration)
  }

  // INIT
  setTimeout(() => {
    tick()
  }, 500)

  function tick () {
    for (i = 0; i < sankeyData.links.length; i++) {
      sankeyData.links[i].value = Math.round(sankeyData.links[i][config.scenarios[activeScenario].id])
    }
    updateSankey(JSON.stringify(sankeyData), config.settings[0].offsetX, config.settings[0].offsetY, config.settings[0].fontSize, config.settings[0].font)
    d3.selectAll('.node-title').style('font-size', '9px')
  }

  function getColor (id, legend) {
    for (let i = 0; i < legend.length; i++) {
      if (legend[i].id === id) {
        return legend[i].color
      }
    }
    console.log('WARNING: DID NOT FIND MATCHING LEGEND ENTRY - "' + id + '"')
    return 'black'
  }

  function getTextWidth (text, fontSize, fontFamily, fontWeight) {
    // Create a temporary span element
    const span = document.createElement('span')
    // Set the span's font properties
    span.style.fontSize = fontSize
    span.style.fontFamily = fontFamily
    // Set the span's text content
    span.textContent = text
    // Add the span to the body to measure its width
    document.body.appendChild(span)
    // Get the width of the span
    const width = span.offsetWidth
    // Remove the span from the body
    document.body.removeChild(span)
    // Return the width
    return width
  }

  function readExcelFile (url, callback) {
    // Create a new XMLHttpRequest object
    const xhr = new XMLHttpRequest()
    // Set up a callback for when the XMLHttpRequest finishes loading the file
    xhr.onload = () => {
      // Get the response data from the XMLHttpRequest
      const data = xhr.response
      // Create a new workbook object from the data
      const workbook = XLSX.read(data, {type: 'array'})
      // Define object variables for each sheet
      let links = {}
      let nodes = {}
      let legend = {}
      let settings = {}
      // Read the data from each sheet
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName]
        switch (sheetName) {
          case 'links':
            links = XLSX.utils.sheet_to_json(worksheet)
            break
          case 'nodes':
            nodes = XLSX.utils.sheet_to_json(worksheet)
            break
          case 'legend':
            legend = XLSX.utils.sheet_to_json(worksheet)
            break
          case 'settings':
            settings = XLSX.utils.sheet_to_json(worksheet)
            break
          default:
            console.log(`Sheet '${sheetName}' ignored.`)
        }
      })
      // Call the callback function with the resulting objects
      callback(links, nodes, legend, settings)
    }
    // Set up the XMLHttpRequest to load the file from the specified URL
    xhr.open('GET', url, true)
    xhr.responseType = 'arraybuffer'
    xhr.send()
  }
}

function drawBarGraph (data, config) {
  console.log(config)
  console.log(data)
  d3.select('#popupBlinder').style('visibility', 'visible').style('opacity', 0).transition().duration(300).style('opacity', 0.3)
  d3.select('#popupBlinder').style('pointer-events', 'all')
  d3.select('#' + config.targetDIV)
    // parent div 
    .append('div')
    .attr('id', 'nodeInfoPopup')
    .style('pointer-events', 'none')
    .style('position', 'absolute').style('top', '40px').style('left', '0px').style('width', '100%').style('height', '100%').style('display', 'flex').style('justify-content', 'center').style('align-items', 'center')
    // child div
    .append('div')
    .style('pointer-events', 'all')
    .attr('id', 'flowAnalysisPopup')
    .style('position', 'absolute')
    .style('box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
    .style('-webkit-box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
    .style('-moz-box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
    .style('margin', 'auto') // centers div
    .style('width', '1000px')
    .style('height', '500px')
    .style('background-color', 'rgba(255,255,255,1)')

  d3.select('#flowAnalysisPopup').append('svg').style('position', 'absolute').style('width', '100%').style('height', '100%').attr('id', 'flowAnalysisSVG_main').style('top', '0px').style('left', '0px')
  // d3.select('#flowAnalysisPopup').append('svg').style('position', 'relative').style('top', '70px').style('left', '20px').style('width', '1000px').style('height', '340px').attr('id', 'flowAnalysisSVG_incoming').attr('transform', 'translate(0,0)')
  // d3.select('#flowAnalysisPopup').append('svg').style('position', 'relative').style('width', '100%').style('top', '20px').style('left', '20px').style('height', '340px').attr('id', 'flowAnalysisSVG_outgoing').attr('transform', 'translate(0,0)')

  let canvas = d3.select('#flowAnalysisSVG_main').append('g')

  canvas.append('text').attr('x', 100).attr('y', 50).style('font-size', '16px').style('font-weight', 800)
    .text(function () {
      console.log(nodesGlobal)
      indexSource = nodesGlobal.findIndex(item => item.id === data.source)
      indexTarget = nodesGlobal.findIndex(item => item.id === data.target)

      // return "Flow '" + data.source + ' - ' + data.target + "'"
      return "Flow '" + nodesGlobal[indexSource].title + ' - ' + nodesGlobal[indexTarget].title + "'"
    })
  canvas.append('path').attr('d', 'M94.333 812.333 40 772.667 232 466l119.714 140 159.619-258.666 109 162.333q-18.333 1.667-35.166 6.167-16.834 4.5-33.5 11.166l-37.334-57-152.371 248.333-121.296-141-146.333 235ZM872.334 1016 741.333 885q-20.666 14.667-45.166 22.333-24.5 7.667-50.5 7.667-72.222 0-122.778-50.578-50.555-50.579-50.555-122.834t50.578-122.754q50.578-50.5 122.833-50.5T768.5 618.889Q819 669.445 819 741.667q0 26-8 50.5t-22 46.465l131 129.702L872.334 1016ZM645.573 848.334q44.76 0 75.761-30.907 31-30.906 31-75.666 0-44.761-30.907-75.761-30.906-31-75.666-31Q601 635 570 665.906q-31 30.906-31 75.667 0 44.76 30.906 75.761 30.906 31 75.667 31ZM724.666 523q-16.333-6.667-33.833-9.666-17.5-3-36.166-4.667l211-332.667L920 215.666 724.666 523Z').attr('transform', 'translate(40,15)scale(0.035)')
  // canvas.append('path').attr('d', 'M180 936q-24 0-42-18t-18-42V276q0-24 18-42t42-18h291v60H180v600h291v60H180Zm486-185-43-43 102-102H375v-60h348L621 444l43-43 176 176-174 174Z').attr('transform', 'translate(60,20)scale(0.025)')
  canvas.append('rect').attr('x', 30).attr('y', 60).attr('width', 940).attr('height', 410).attr('fill', '#fff')
  // canvas.append('rect').attr('x', 30).attr('y', 350).attr('width', 940).attr('height', 270).attr('fill', '#eee')
  // canvas.append('path').attr('d', 'M489 936v-60h291V276H489v-60h291q24 0 42 18t18 42v600q0 24-18 42t-42 18H489Zm-78-185-43-43 102-102H120v-60h348L366 444l43-43 176 176-174 174Z').attr('transform', 'translate(40,70)scale(0.03)').attr('fill', '#888')
  // canvas.append('text').style('font-size', '12px').attr('x', 75).attr('y', 90).text('IN')
  // canvas.append('path').attr('d', 'M180 936q-24 0-42-18t-18-42V276q0-24 18-42t42-18h291v60H180v600h291v60H180Zm486-185-43-43 102-102H375v-60h348L621 444l43-43 176 176-174 174Z').attr('transform', 'translate(40,360)scale(0.03)').attr('fill', '#888')
  // canvas.append('text').style('font-size', '12px').attr('x', 75).attr('y', 380).text('UIT')

  canvas.append('rect')
    .attr('x', 955).attr('y', 15)
    .attr('width', 30)
    .attr('height', 30)
    .attr('fill', '#FFF')
    .style('pointer-events', 'all')
    .on('mouseover', function () {
      d3.select(this).attr('fill', '#999')
      d3.select('#' + config.targetDIV + '_closeButton').attr('fill', '#fff')
    })
    .on('mouseout', function () {
      d3.select(this).attr('fill', '#fff')
      d3.select('#' + config.targetDIV + '_closeButton').attr('fill', '#000')
    })
    .on('click', function () {
      d3.select('#nodeInfoPopup').remove()
      d3.select('#popupBlinder').style('visibility', 'hidden')
      d3.select('#popupBlinder').style('pointer-events', 'none')
    })
  canvas.append('path').style('pointer-events', 'none').attr('id', config.targetDIV + '_closeButton').attr('d', 'm249 849-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z').attr('transform', 'translate(951,7)scale(0.04)')

  // vlakken demarcatie scenariogroepen
  canvas.append('rect').attr('width', 325).attr('height', 25).attr('x', 144).attr('y', 85).attr('fill', '#666')
  canvas.append('rect').attr('width', 431).attr('height', 25).attr('x', 474).attr('y', 85).attr('fill', '#333')

  var colorVlak = '#eee'
  canvas.append('rect').attr('width', 105).attr('height', 325).attr('x', 144).attr('y', 115).attr('fill', colorVlak)
  canvas.append('rect').attr('width', 105).attr('height', 325).attr('x', 254).attr('y', 115).attr('fill', colorVlak)
  canvas.append('rect').attr('width', 105).attr('height', 325).attr('x', 364).attr('y', 115).attr('fill', colorVlak)
  colorVlak = '#ddd'
  canvas.append('rect').attr('width', 73).attr('height', 325).attr('x', 474).attr('y', 115).attr('fill', colorVlak)
  canvas.append('rect').attr('width', 135).attr('height', 325).attr('x', 552).attr('y', 115).attr('fill', colorVlak)
  canvas.append('rect').attr('width', 135).attr('height', 325).attr('x', 692).attr('y', 115).attr('fill', colorVlak)
  canvas.append('rect').attr('width', 73).attr('height', 325).attr('x', 832).attr('y', 115).attr('fill', colorVlak)

  console.log(data) // REFERENCE 
  // Define the dimensions of the chart
  const margin = { top: 10, right: 30, bottom: 30, left: 60 }

  const height = 180 // d3.max(Object.values(data).filter(val => typeof val === 'number')) - margin.top - margin.bottom
  // Define the x and y scales
  const shiftX = 130
  var shiftXAdditional = 20
  const spacing = 20
  const width = 750 - 6 * spacing
  let source = Object.entries(data).filter(([key, val]) => key.includes('scenario'))

  const x = d3.scaleBand()
    .range([0, width])
    .domain(Object.keys(data).filter(key => key.includes('scenario')).map(key => key.substring(0, key.indexOf('_'))))
    .padding(0.1)
  const y = d3.scaleLinear()
    .range([height, 0])
    .domain([0, d3.max(source.map(entry => entry[1]))])

  // Add the y-axis gridlines
  const yAxis = d3.axisLeft(y)
    .tickSize(-width - 140) // Adjust this value to control the length of the gridlines
    .tickFormat('') // Remove tick labels, only display gridlines
    .tickSizeOuter(0) // Prevent the gridline at the top
    .ticks(5) // Set the maximum number of ticks to 5

  const yAxisGroup = canvas.append('g')
    .call(yAxis)
    .attr('transform', 'translate(' + shiftX + ', 150)')

  // Style the gridlines
  yAxisGroup.selectAll('.tick line')
    .style('stroke', '#111')
    .style('stroke-width', 0.5)
    .style('opacity', 0.7)
    .style('stroke-dasharray', '4,4')

  yAxisGroup.selectAll('text')
    .style('font-size', '13px')
  // draw bars
  canvas.selectAll('.bar')
    .data(Object.entries(data).filter(([key, val]) => key.includes('scenario')))
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('fill', function (d, i) {
      // console.log(config.legend)
      // console.log(data.)
      index = config.legend.findIndex(item => item.id === data.legend)
      return config.legend[index].color
    })
    .attr('x', d => x(d[0].substring(0, d[0].indexOf('_'))))
    .attr('y', d => y(d[1]))
    .attr('width', x.bandwidth())
    .attr('height', d => height - y(d[1]))
    .attr('transform', function (d, i) {
      // add spacing between scenario groupings
      if (i == 3) {shiftXAdditional = shiftXAdditional + spacing}
      if (i == 6) {shiftXAdditional = shiftXAdditional + spacing}
      if (i == 9) {shiftXAdditional = shiftXAdditional + spacing}
      if (i == 11) {shiftXAdditional = shiftXAdditional + spacing}
      if (i == 15) {shiftXAdditional = shiftXAdditional + spacing}
      if (i == 19) {shiftXAdditional = shiftXAdditional + spacing}
      let returnX = shiftX + shiftXAdditional
      return 'translate(' + returnX + ',150)'
    })

  // Add the x-axis
  // posx = shiftX
  posy = height + 165
  shiftXAdditional = 20
  let dataEntries = Object.entries(data).filter(([key, val]) => key.includes('scenario'))
  let varianten = ['2025', '2030', '2035', '2025', '2030', '2035', '2025', '2030', '2035', '2040', '2050', '2040', '2050', ' (zero) 2050', '(synfuels) 2050', '2040', '2050', '(zero) 2050', '(synfuels) 2050', '2040', '2050']
  for (j = 0;j < dataEntries.length;j++) {
    canvas.append('text')
      .style('text-anchor', 'end')
      .style('font-size', '12px')
      .attr('transform', function () {
        // add spacing between scenario groupings
        if (j == 3) {shiftXAdditional = shiftXAdditional + spacing}
        if (j == 6) {shiftXAdditional = shiftXAdditional + spacing}
        if (j == 9) {shiftXAdditional = shiftXAdditional + spacing}
        if (j == 11) {shiftXAdditional = shiftXAdditional + spacing}
        if (j == 15) {shiftXAdditional = shiftXAdditional + spacing}
        if (j == 19) {shiftXAdditional = shiftXAdditional + spacing}
        posx = shiftX + shiftXAdditional + j * 30 + 23
        return 'translate(' + posx + ',' + posy + ')rotate(-90)'
      })
      .text(varianten[j])
  }
  canvas.append('text').attr('x', 155).attr('y', 102).style('font-size', '13px').attr('fill', 'white').text("IP2024 - Scenario's InvesteringsPlannen 2024")
  canvas.append('text').attr('x', 485).attr('y', 102).style('font-size', '13px').attr('fill', 'white').text("II3050 - Scenario's Integrale Infrastructuurverkenning 2040/2050")

  canvas.append('text').attr('x', 195).attr('y', 140).style('font-size', '16px').style('text-anchor', 'middle').attr('fill', 'black').text('KA')
  canvas.append('text').attr('x', 305).attr('y', 140).style('font-size', '16px').style('text-anchor', 'middle').attr('fill', 'black').text('ND')
  canvas.append('text').attr('x', 415).attr('y', 140).style('font-size', '16px').style('text-anchor', 'middle').attr('fill', 'black').text('IA')
  canvas.append('text').attr('x', 510).attr('y', 140).style('font-size', '16px').style('text-anchor', 'middle').attr('fill', 'black').text('DEC')
  canvas.append('text').attr('x', 620).attr('y', 140).style('font-size', '16px').style('text-anchor', 'middle').attr('fill', 'black').text('NAT')
  canvas.append('text').attr('x', 720 + 35).attr('y', 140).style('font-size', '16px').style('text-anchor', 'middle').attr('fill', 'black').text('EUR')
  canvas.append('text').attr('x', 720 + 35 + 110).attr('y', 140).style('font-size', '16px').style('text-anchor', 'middle').attr('fill', 'black').text('INT')

  // Add the y-axis
  canvas.append('g')
    .call(d3.axisLeft(y))
    .attr('transform', 'translate(' + shiftX + ',' + 150 + ')')
    .selectAll('text')
    .style('font-size', '13px')

  // y-axis title
  canvas.append('text').attr('transform', 'translate(50,' + height * 1.2 + ')rotate(-90)').attr('dy', '1em').style('font-size', '12px').style('text-anchor', 'middle').text('Energie (PJ/jaar)')
}

function nodeVisualisatieSingular (config, node, data, scenarios) {
  d3.select('#popupBlinder').style('visibility', 'visible').style('opacity', 0).transition().duration(300).style('opacity', 0.3)
  d3.select('#popupBlinder').style('pointer-events', 'all')

  console.log(config)
  console.log(data)
  d3.select('#popupBlinder').style('visibility', 'visible').style('opacity', 0).transition().duration(300).style('opacity', 0.3)
  d3.select('#popupBlinder').style('pointer-events', 'all')
  d3.select('#' + config.targetDIV)
    // parent div 
    .append('div')
    .attr('id', 'nodeInfoPopup')
    .style('pointer-events', 'none')
    .style('position', 'absolute').style('top', '40px').style('left', '0px').style('width', '100%').style('height', '100%').style('display', 'flex').style('justify-content', 'center').style('align-items', 'center')
    // child div
    .append('div')
    .style('pointer-events', 'all')
    .attr('id', 'flowAnalysisPopup')
    .style('position', 'absolute')
    .style('box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
    .style('-webkit-box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
    .style('-moz-box-shadow', '10px 20px 69px -15px rgba(0,0,0,0.75)')
    .style('margin', 'auto') // centers div
    .style('width', '1000px')
    .style('height', '500px')
    .style('background-color', 'rgba(255,255,255,1)')

  d3.select('#flowAnalysisPopup').append('svg').style('position', 'absolute').style('width', '100%').style('height', '100%').attr('id', 'flowAnalysisSVG_main').style('top', '0px').style('left', '0px')

  let canvas = d3.select('#flowAnalysisSVG_main').append('g')

  canvas.append('text').attr('x', 100).attr('y', 50).style('font-size', '16px').style('font-weight', 800).text("Node '" + node.title + "'")
  canvas.append('path').attr('d', 'M94.333 812.333 40 772.667 232 466l119.714 140 159.619-258.666 109 162.333q-18.333 1.667-35.166 6.167-16.834 4.5-33.5 11.166l-37.334-57-152.371 248.333-121.296-141-146.333 235ZM872.334 1016 741.333 885q-20.666 14.667-45.166 22.333-24.5 7.667-50.5 7.667-72.222 0-122.778-50.578-50.555-50.579-50.555-122.834t50.578-122.754q50.578-50.5 122.833-50.5T768.5 618.889Q819 669.445 819 741.667q0 26-8 50.5t-22 46.465l131 129.702L872.334 1016ZM645.573 848.334q44.76 0 75.761-30.907 31-30.906 31-75.666 0-44.761-30.907-75.761-30.906-31-75.666-31Q601 635 570 665.906q-31 30.906-31 75.667 0 44.76 30.906 75.761 30.906 31 75.667 31ZM724.666 523q-16.333-6.667-33.833-9.666-17.5-3-36.166-4.667l211-332.667L920 215.666 724.666 523Z').attr('transform', 'translate(40,25)scale(0.035)')
  canvas.append('rect').attr('x', 30).attr('y', 60).attr('width', 940).attr('height', 410).attr('fill', '#fff')

  canvas.append('rect')
    .attr('x', 955).attr('y', 15)
    .attr('width', 30)
    .attr('height', 30)
    .attr('fill', '#FFF')
    .style('pointer-events', 'all')
    .on('mouseover', function () {
      d3.select(this).attr('fill', '#999')
      d3.select('#' + config.targetDIV + '_closeButton').attr('fill', '#fff')
    })
    .on('mouseout', function () {
      d3.select(this).attr('fill', '#fff')
      d3.select('#' + config.targetDIV + '_closeButton').attr('fill', '#000')
    })
    .on('click', function () {
      d3.select('#nodeInfoPopup').remove()
      d3.select('#popupBlinder').style('visibility', 'hidden')
      d3.select('#popupBlinder').style('pointer-events', 'none')
    })
  canvas.append('path').style('pointer-events', 'none').attr('id', config.targetDIV + '_closeButton').attr('d', 'm249 849-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z').attr('transform', 'translate(951,7)scale(0.04)')

  // vlakken demarcatie scenariogroepen
  canvas.append('rect').attr('width', 325).attr('height', 25).attr('x', 144).attr('y', 90 - 5).attr('fill', '#666')
  canvas.append('rect').attr('width', 431).attr('height', 25).attr('x', 474).attr('y', 90 - 5).attr('fill', '#333')

  var colorVlak = '#eee'
  canvas.append('rect').attr('width', 105).attr('height', 365 - 20 - 20).attr('x', 144).attr('y', 90 + 30 - 5).attr('fill', colorVlak)
  canvas.append('rect').attr('width', 105).attr('height', 365 - 20 - 20).attr('x', 254).attr('y', 90 + 30 - 5).attr('fill', colorVlak)
  canvas.append('rect').attr('width', 105).attr('height', 365 - 20 - 20).attr('x', 364).attr('y', 90 + 30 - 5).attr('fill', colorVlak)
  colorVlak = '#ddd'
  canvas.append('rect').attr('width', 73).attr('height', 365 - 20 - 20).attr('x', 474).attr('y', 90 + 30 - 5).attr('fill', colorVlak)
  canvas.append('rect').attr('width', 135).attr('height', 365 - 20 - 20).attr('x', 552).attr('y', 90 + 30 - 5).attr('fill', colorVlak)
  canvas.append('rect').attr('width', 135).attr('height', 365 - 20 - 20).attr('x', 692).attr('y', 90 + 30 - 5).attr('fill', colorVlak)
  canvas.append('rect').attr('width', 73).attr('height', 365 - 20 - 20).attr('x', 832).attr('y', 90 + 30 - 5).attr('fill', colorVlak)

  let dataIncoming = []
  for (i = 0;i < data.links.length;i++) {
    if (data.links[i].target == node.id) {
      dataIncoming.push(data.links[i])
    }
  }

  // construct outgoing dataset
  let dataOutgoing = []
  for (i = 0;i < data.links.length;i++) {
    if (data.links[i].source == node.id) {
      dataOutgoing.push(data.links[i])
    }
  }

  // add titles to links, source form nodes
  for (i = 0;i < dataIncoming.length;i++) {
    dataIncoming[i]['title'] = getTitleById(data.nodes, dataIncoming[i].source)
  }
  for (i = 0;i < dataOutgoing.length;i++) {
    dataOutgoing[i]['title'] = getTitleById(data.nodes, dataOutgoing[i].target)
  }

  // construct bargraph datasets
  let bargraphDataIncoming = []

  for (i = 0;i < scenarios.length;i++) {
    let lookupID = scenarios[i].id
    bargraphDataIncoming.push({scenario: scenarios[i].title})
    for (j = 0;j < dataIncoming.length;j++) {
      bargraphDataIncoming[i][dataIncoming[j].title + ' ' + '(' + dataIncoming[j].legend + ')' + '_' + j] = dataIncoming[j][lookupID]
    }
  }

  let bargraphDataOutgoing = []
  for (i = 0;i < scenarios.length;i++) {
    let lookupID = scenarios[i].id
    bargraphDataOutgoing.push({scenario: scenarios[i].title})
    for (j = 0;j < dataOutgoing.length;j++) {
      bargraphDataOutgoing[i][dataOutgoing[j].title + ' ' + '(' + dataOutgoing[j].legend + ')' + '_' + j] = dataOutgoing[j][lookupID]
    }
  }

  let nodeAnalysisSVG = d3.select('#nodeAnalysisSVG').append('g')

  let tempTotalOut = 0
  let tempTotalIn = 0
  for (i = 1; i < Object.keys(bargraphDataIncoming[0]).length;i++) {
    tempTotalIn += bargraphDataIncoming[0][Object.keys(bargraphDataIncoming[0])[i]]
  }
  for (i = 1; i < Object.keys(bargraphDataOutgoing[0]).length;i++) {
    tempTotalOut += bargraphDataOutgoing[0][Object.keys(bargraphDataOutgoing[0])[i]]
  }

  data = {}
  for (i = 0; i < scenarios.length;i++) {
    tempTotalIn = 0
    for (j = 1; j < Object.keys(bargraphDataIncoming[0]).length;j++) {
      tempTotalIn += bargraphDataIncoming[i][Object.keys(bargraphDataIncoming[i])[j]]
    }
    tempTotalOut = 0
    for (j = 1; j < Object.keys(bargraphDataOutgoing[0]).length;j++) {
      tempTotalOut += bargraphDataOutgoing[i][Object.keys(bargraphDataOutgoing[i])[j]]
    }
    console.log(tempTotalIn)
    console.log(tempTotalOut)
    if (tempTotalIn != 0) {data[scenarios[i].id] = tempTotalIn } else {data[scenarios[i].id] = tempTotalOut}
  // TODO: kijkt nu naar incoming, negeert outgoing. Toevoegen check of in = uit en melding maken bij mismatch
  }

  nodeAnalysisSVG.append('text').attr('x', 20).attr('y', 20).text('incoming: ' + tempTotalIn)
  nodeAnalysisSVG.append('text').attr('x', 20).attr('y', 50).text('outgoing: ' + tempTotalOut)

  function getTitleById (data, id_lookup) {
    for (let i = 0; i < data.length; i++) {
      if (data[i].id === id_lookup) {
        return data[i].title
      }
    }
    return null // Return null if no object with matching id is found
  }

  console.log(scenarios)
  console.log(data)
  // Define the dimensions of the chart
  const margin = { top: 10, right: 30, bottom: 30, left: 60 }

  const height = 180 // d3.max(Object.values(data).filter(val => typeof val === 'number')) - margin.top - margin.bottom
  // Define the x and y scales
  const shiftX = 130
  var shiftXAdditional = 20
  const spacing = 20
  const width = 750 - 6 * spacing
  let source = Object.entries(data).filter(([key, val]) => key.includes('scenario'))

  const x = d3.scaleBand()
    .range([0, width])
    .domain(Object.keys(data).filter(key => key.includes('scenario')).map(key => key.substring(0, key.indexOf('_'))))
    .padding(0.1)
  const y = d3.scaleLinear()
    .range([height, 0])
    .domain([0, d3.max(source.map(entry => entry[1]))])
  canvas.selectAll('.bar')
    .data(Object.entries(data).filter(([key, val]) => key.includes('scenario')))
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('fill', '#000')
    .attr('x', d => x(d[0].substring(0, d[0].indexOf('_'))))
    .attr('y', d => y(d[1]))
    .attr('width', x.bandwidth())
    .attr('height', d => height - y(d[1]))
    .attr('transform', function (d, i) {
      // add spacing between scenario groupings
      if (i == 3) {shiftXAdditional = shiftXAdditional + spacing}
      if (i == 6) {shiftXAdditional = shiftXAdditional + spacing}
      if (i == 9) {shiftXAdditional = shiftXAdditional + spacing}
      if (i == 11) {shiftXAdditional = shiftXAdditional + spacing}
      if (i == 15) {shiftXAdditional = shiftXAdditional + spacing}
      if (i == 19) {shiftXAdditional = shiftXAdditional + spacing}
      let returnX = shiftX + shiftXAdditional
      return 'translate(' + returnX + ',150)'
    })
  // Add the x-axis
  // posx = shiftX
  posy = height + 165
  shiftXAdditional = 20
  let dataEntries = Object.entries(data).filter(([key, val]) => key.includes('scenario'))
  let varianten = ['2025', '2030', '2035', '2025', '2030', '2035', '2025', '2030', '2035', '2040', '2050', '2040', '2050', ' (zero) 2050', '(synfuels) 2050', '2040', '2050', '(zero) 2050', '(synfuels) 2050', '2040', '2050']
  for (j = 0;j < dataEntries.length;j++) {
    canvas.append('text')
      .style('text-anchor', 'end')
      .style('font-size', '12px')
      .attr('transform', function () {
        // add spacing between scenario groupings
        if (j == 3) {shiftXAdditional = shiftXAdditional + spacing}
        if (j == 6) {shiftXAdditional = shiftXAdditional + spacing}
        if (j == 9) {shiftXAdditional = shiftXAdditional + spacing}
        if (j == 11) {shiftXAdditional = shiftXAdditional + spacing}
        if (j == 15) {shiftXAdditional = shiftXAdditional + spacing}
        if (j == 19) {shiftXAdditional = shiftXAdditional + spacing}
        posx = shiftX + shiftXAdditional + j * 30 + 23
        return 'translate(' + posx + ',' + posy + ')rotate(-90)'
      })
      .text(varianten[j])
  }
  canvas.append('text').attr('x', 155).attr('y', 102).style('font-size', '13px').attr('fill', 'white').text("IP2024 - Scenario's InvesteringsPlannen 2024")
  canvas.append('text').attr('x', 485).attr('y', 102).style('font-size', '13px').attr('fill', 'white').text("II3050 - Scenario's Integrale Infrastructuurverkenning 2040/2050")

  canvas.append('text').attr('x', 195).attr('y', 140).style('font-size', '16px').style('text-anchor', 'middle').attr('fill', 'black').text('KA')
  canvas.append('text').attr('x', 305).attr('y', 140).style('font-size', '16px').style('text-anchor', 'middle').attr('fill', 'black').text('ND')
  canvas.append('text').attr('x', 415).attr('y', 140).style('font-size', '16px').style('text-anchor', 'middle').attr('fill', 'black').text('IA')
  canvas.append('text').attr('x', 510).attr('y', 140).style('font-size', '16px').style('text-anchor', 'middle').attr('fill', 'black').text('DEC')
  canvas.append('text').attr('x', 620).attr('y', 140).style('font-size', '16px').style('text-anchor', 'middle').attr('fill', 'black').text('NAT')
  canvas.append('text').attr('x', 720 + 35).attr('y', 140).style('font-size', '16px').style('text-anchor', 'middle').attr('fill', 'black').text('EUR')
  canvas.append('text').attr('x', 720 + 35 + 110).attr('y', 140).style('font-size', '16px').style('text-anchor', 'middle').attr('fill', 'black').text('INT')

  // Add the y-axis
  canvas.append('g')
    .call(d3.axisLeft(y))
    .attr('transform', 'translate(' + shiftX + ',' + 150 + ')')
    .selectAll('text')
    .style('font-size', '13px')
  // y-axis title
  canvas.append('text').attr('transform', 'translate(50,' + height * 1.2 + ')rotate(-90)').attr('dy', '1em').style('font-size', '12px').style('text-anchor', 'middle').text('Energie (PJ/jaar)')
}

function wrap (text, width) {
  text.each(function () {
    var text = d3.select(this),
      words = text.text().split(/\s+/).reverse(),
      word,
      line = [],
      lineNumber = 0,
      lineHeight = 1.8, // ems
      y = text.attr('y'),
      dy = parseFloat(text.attr('dy'))
    if (isNaN(dy)) {dy = 0}
    var tspan = text.text(null).append('tspan').attr('x', 10).attr('y', y).attr('dy', dy + 'em')
    while (word = words.pop()) {
      line.push(word)
      tspan.text(line.join(' '))
      if (tspan.node().getComputedTextLength() > width) {
        line.pop()
        tspan.text(line.join(' '))
        line = [word]
        tspan = text.append('tspan').attr('x', 10).attr('y', 0).attr('dy', ++lineNumber * lineHeight + dy + 'em').text(word) // changed x from 0 to 20 TIJS
      }
    }
  })
}
