(function(root){
  'use strict';
  var api=root.SpjutsimFEA;
  function convergenceErrorMessage(error) {
    var value = error && error.diagnostic ? error.diagnostic : error;
    return value && (value.userMessage || value.message) || null;
  }
  function convergenceStatusMessage(study) {
    var levels = study && Array.isArray(study.levels) ? study.levels : [];
    var classification = study && study.classification;
    var statusLabels = { converged: 'Converged', 'converged-stress-unresolved': 'Converged globally; stress unresolved',
      unconverged: 'Unconverged', 'indeterminate-resource-limit': 'Indeterminate — resource limit', failed: 'Failed' };
    var message;
    var errorMessage;
    if (!study) { return 'Not studied.'; }
    var quick = study.settings && study.settings.maxLevels === 2;
    if (study.status === 'running') {
      return (quick ? 'Quick mesh check · ' : '') + 'Level ' + ((study.progress && study.progress.level) || levels.length + 1) + ': ' +
        ((study.progress && (study.progress.userMessage || study.progress.stage)) || 'preparing') + '…';
    }
    if (study.status === 'cancelled') { return (quick ? 'Quick mesh check cancelled' : 'Cancelled') + ' — completed levels remain available in the table.'; }
    message = statusLabels[classification && classification.status] || study.status;
    errorMessage = convergenceErrorMessage(study.error);
    if (errorMessage) { message += ' — ' + errorMessage; }
    else if (study.stopReason === 'high-memory-confirmation') { message += ' — high-memory confirmation was declined.'; }
    else if (study.stopReason === 'resource-limit') { message += ' — the next level exceeded the configured memory limit.'; }
    else if (study.stopReason === 'level-limit' && classification && (!classification.globalConverged || !classification.stressStable)) {
      message += ' — the ' + (study.settings ? study.settings.maxLevels : 4) + '-level limit was reached.';
    }
    if (quick) {
      var summary = classification && classification.status === 'converged' ? 'Within refinement thresholds.' :
        classification && classification.status === 'converged-stress-unresolved' ? 'Displacement/energy within thresholds; peak stress needs review.' : message;
      if (classification && classification.warning) { summary += ' ' + classification.warning; }
      return 'Quick mesh check: ' + summary + (levels.length >= 2 ? ' One refinement comparison; this is not an error bound.' : ' No refinement comparison completed.');
    }
    if (classification && classification.globalConverged && !classification.stressStable) { message += ' Strength assessment remains unresolved.'; }
    if (classification && classification.warning) { message += ' ' + classification.warning; }
    return message;
  }
  api.convergenceStatusMessage=convergenceStatusMessage;
  var quantities=[
    {field:'maximumDisplacementM',label:'Maximum displacement',unit:'lengthM',tolerance:'displacementTolerance'},
    {field:'rawVonMisesMaxPa',label:'Peak von Mises (unaveraged)',unit:'stressPa',tolerance:'stressTolerance'},
    {field:'strainEnergyJ',label:'Strain energy',unit:'energyJ',tolerance:'strainEnergyTolerance'}
  ];
  function element(tag,text,parent){
    var node=document.createElement(tag);node.textContent=text;if(parent)parent.appendChild(node);return node;
  }
  function svgElement(tag,attributes,parent,text){
    var node=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.keys(attributes).forEach(key=>node.setAttribute(key,attributes[key]));
    if(text!==undefined)node.textContent=text;parent.appendChild(node);return node;
  }
  function comparison(levels,quantity,settings){
    if(levels.length<2)return null;
    var previous=levels[levels.length-2][quantity.field],current=levels[levels.length-1][quantity.field];
    var change=api.convergenceRelativeChange(current,previous),limit=settings[quantity.tolerance];
    return {within:change<=limit+1e-12*Math.max(1,Math.abs(limit)),text:
      (Number.isFinite(change)?api.formatResultNumber(change*100)+'% '+(current===previous?'change':current>previous?'increase':'decrease'):'Changed from zero; percentage undefined')+
      ' · threshold '+api.formatResultNumber(limit*100)+'%'};
  }
  function drawChart(parent,levels,quantity,settings){
    var unit=api.preferredUnit(quantity.unit);
    var values=levels.map(level=>api.preferredFromSI(quantity.unit,level[quantity.field]));
    var dofs=levels.map(level=>level.degreeOfFreedomCount),lo=Math.min(...dofs),hi=Math.max(...dofs);
    var maximum=Math.max(...values),band=null,bandLabel='';
    if(levels.length>=2){
      var previous=values[values.length-2],tolerance=settings[quantity.tolerance],delta=Math.abs(previous)*tolerance;
      band={lower:previous-delta,upper:previous+delta};
      bandLabel='Convergence band (mesh '+levels[levels.length-2].level+' ±'+api.formatResultNumber(tolerance*100)+'%): '+
        api.formatResultNumber(band.lower)+'–'+api.formatResultNumber(band.upper)+' '+unit;
    }
    var minimum=Math.min(...values),floor=Math.min(minimum,band?band.lower:minimum);
    var ceiling=Math.max(maximum,band?band.upper:maximum);
    var padding=(ceiling-floor || Math.abs(ceiling) || 1)*0.08;
    floor=Math.max(0,floor-padding);ceiling+=padding;
    var scale=ceiling-floor;
    var measured=levels.map((level,i)=>'Mesh '+level.level+': '+api.formatResultNumber(values[i])+' '+unit+', '+dofs[i]+' degrees of freedom').join('; ');
    var svg=svgElement('svg',{viewBox:'0 0 320 156',role:'img','aria-label':quantity.label+'. '+measured+(band?'. '+bandLabel:'')},parent);
    var left=84,right=306,top=18,bottom=110;
    var x=value=>hi===lo?(left+right)/2:left+(value-lo)/(hi-lo)*(right-left);
    var y=value=>bottom-(value-floor)/scale*(bottom-top);
    if(band){
      var upperY=y(band.upper),lowerY=y(band.lower);
      svgElement('rect',{class:'fea-convergence-band',x:left,y:upperY,width:right-left,height:lowerY-upperY,
        fill:'var(--accent, #4387f5)','fill-opacity':0.28},svg);
      [upperY,lowerY].forEach(y=>svgElement('line',{x1:left,x2:right,y1:y,y2:y,stroke:'currentColor','stroke-dasharray':'4 3','stroke-opacity':0.65},svg));
    }
    svgElement('path',{d:'M'+left+','+top+' V'+bottom+' H'+right,fill:'none',stroke:'currentColor',opacity:'.5'},svg);
    // Measure SVG text in its own coordinates so collision checks follow pane scaling.
    function axisLabel(value,axis,accepted){
      var vertical=axis==='y',position=vertical?y(value):x(value);
      var label=svgElement('text',{class:'fea-convergence-'+axis+'-label',
        x:vertical?left-7:position,y:vertical?position+4:bottom+18,
        'text-anchor':vertical?'end':value===lo && lo!==hi?'start':value===hi && lo!==hi?'end':'middle'},
        svg,vertical?api.formatResultNumber(value):String(value));
      var box=label.getBBox();
      if(accepted.some(b=>!(box.x+box.width+4<=b.x || b.x+b.width+4<=box.x ||
        box.y+box.height+4<=b.y || b.y+b.height+4<=box.y))){label.remove();return;}
      accepted.push(box);
    }
    var yLabels=[],xLabels=[];
    axisLabel(floor,'y',yLabels);axisLabel(ceiling,'y',yLabels);
    // Prefer the latest and reference values when nearby samples compete for space.
    values.slice().reverse().forEach(value=>axisLabel(value,'y',yLabels));
    axisLabel(lo,'x',xLabels);
    if(hi!==lo)axisLabel(hi,'x',xLabels);
    if(dofs.length>2)axisLabel(dofs[dofs.length-2],'x',xLabels);
    svgElement('text',{x:(left+right)/2,y:150,'text-anchor':'middle'},svg,'Degrees of freedom (DOF)');
    var points=values.map((v,i)=>[x(dofs[i]),y(v)]);
    svgElement('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'currentColor','stroke-width':2},svg);
    points.forEach((point,i)=>{
      var circle=svgElement('circle',{cx:point[0],cy:point[1],r:3,fill:'currentColor'},svg);
      svgElement('title',{},circle,'Mesh '+levels[i].level+': '+api.formatResultNumber(values[i])+' '+unit);
    });
    if(band)element('p',bandLabel,parent).className='fea-help';
    if(maximum===0)element('p','All recorded values are zero.',parent).className='fea-help';
  }
  // Presentation reads compact completed-level summaries; it never alters classification.
  api.renderConvergenceCharts=function(host,study){
    host.replaceChildren();
    var levels=study && study.levels || [];
    if(!levels.length){element('p','No mesh comparison yet. Solve, then choose Check with a finer mesh.',host);return;}
    var settings=api.createConvergenceSettings(study.settings),checks=quantities.map(q=>comparison(levels,q,settings));
    var incomplete=study.status!=='completed';
    element('p',levels.length<2?'One mesh recorded. Compare with another mesh to assess sensitivity.':
      (incomplete?'Completed meshes only; the study is '+study.status+'. ':'')+
      'Last comparison: mesh '+levels[levels.length-2].level+' → '+levels[levels.length-1].level+'. Changes are relative to the earlier mesh.',host);
    element('p','Charts auto-range to the data and convergence band. DOF counts displacement unknowns in the mesh.',host).className='fea-help';
    quantities.forEach(function(quantity,index){
      var card=element('section','',host);card.className='fea-convergence-chart';
      element('h3',quantity.label+' ('+api.preferredUnit(quantity.unit)+')',card);
      if(checks[index])element('p',(checks[index].within?'Within mesh threshold · ':'Still mesh-sensitive · ')+checks[index].text,card);
      drawChart(card,levels,quantity,settings);
    });
    if(levels.length>=2){
      var guidance;
      if(!checks[1].within)guidance='Peak stress remains mesh-sensitive. Locate the peak and review local geometry, supports and loads. Peak-based FoS cannot yet establish whether that region meets the requirement.';
      else if(!checks[0].within || !checks[2].within)guidance='Peak stress meets its mesh threshold, but displacement or energy still changes too much. Check with a finer mesh to assess the remaining sensitivity.';
      else guidance='All three quantities meet their mesh-change thresholds for this comparison.';
      element('p',guidance+' '+(levels.length===2?'Two meshes provide a screening check, not proof of convergence. ':'')+
        'Compare displacement and FoS with your design requirements separately.',host);
    }
  };
}(globalThis));
