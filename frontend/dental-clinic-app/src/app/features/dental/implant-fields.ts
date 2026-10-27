export type ImplantValue = string | number | boolean | string[] | null;
export interface ImplantData { [key: string]: ImplantValue | ImplantData; }
export interface ImplantWorkflow {
  schemaVersion: number; planning: ImplantData; placement: ImplantData; healingVisits: ImplantData[];
  abutment: ImplantData; scan: ImplantData; fixation: ImplantData; followupVisits: ImplantData[];
}
export interface ImplantOption { value: string; en: string; ar: string; }
export interface ImplantField {
  key: string; en: string; ar: string; kind: 'radio' | 'select' | 'text' | 'number' | 'date' | 'checks' | 'notes' | 'toggle';
  options?: ImplantOption[]; required?: boolean; min?: number; max?: number; when?: [string, ImplantValue]; wide?: boolean;
}
const options = (...values: string[]): ImplantOption[] => values.map(value => { const [id,en,ar] = value.split('|'); return {value:id,en,ar}; });
const radio = (key:string,en:string,ar:string,...values:string[]): ImplantField => ({key,en,ar,kind:'radio',required:true,options:options(...values)});
const select = (key:string,en:string,ar:string,...values:string[]): ImplantField => ({...radio(key,en,ar,...values),kind:'select'});
const text = (key:string,en:string,ar:string,required=true):ImplantField => ({key,en,ar,kind:'text',required});
const number = (key:string,en:string,ar:string,min:number,max:number,required=true):ImplantField => ({key,en,ar,kind:'number',min,max,required});
const date = ():ImplantField => ({key:'date',en:'Visit date',ar:'تاريخ الزيارة',kind:'date',required:true});
const notes = ():ImplantField => ({key:'notes',en:'Notes (optional)',ar:'ملاحظات (اختياري)',kind:'notes',wide:true});
const checks = (key:string,en:string,ar:string,...values:string[]):ImplantField => ({...radio(key,en,ar,...values),kind:'checks',required:false});
const yesNo = ['yes|Yes|نعم','no|No|لا'];
export const implantStages = [
  {en:'Planning & Assessment',ar:'التقييم والتخطيط',key:'planning'},
  {en:'Implant Placement',ar:'زراعة الغرسة',key:'placement'},
  {en:'Healing (Follow-up)',ar:'الالتئام والمتابعة',key:'healingVisits'},
  {en:'Abutment Selection',ar:'اختيار الدعامة',key:'abutment'},
  {en:'Scan / Impression & Crown Details',ar:'المسح أو الطبعة وبيانات التركيبة',key:'scan'},
  {en:'Final Fixation (Crown Seating)',ar:'التثبيت النهائي للتركيبة',key:'fixation'},
  {en:'Follow-up',ar:'المتابعة بعد التركيب',key:'followupVisits'},
] as const;
export const implantFields: ImplantField[][] = [
  [radio('imaging','Imaging','التصوير الشعاعي','cbct|CBCT|تصوير ثلاثي الأبعاد','xray|X-ray|أشعة بانوراما / داخل الفم','none|Not yet|لم يتم بعد'),
   radio('timing','Implant timing','خطة الزراعة','immediate|Immediate|فورية','delayed|Delayed|مؤجلة','undecided|To be determined|يحدد لاحقًا'),
   radio('graft','Bone grafting required?','هل يلزم تطعيم عظمي؟',...yesNo,'assess|To assess|يتم التقييم لاحقًا'),
   {...radio('guide','Surgical guide (optional)','استخدام دليل جراحي (اختياري)',...yesNo),required:false},notes()],
  [date(),text('brand','Implant brand','شركة الزراعة'),text('system','Implant system','نظام الزراعة'),text('model','Model (optional)','الموديل (اختياري)',false),
   text('connection','Platform / Connection','المنصة / الاتصال'),number('diameter','Diameter (mm)','القطر (مم)',1,10),number('length','Length (mm)','الطول (مم)',3,30),
   radio('placementType','Placement type','نوع الزراعة','delayed|Conventional (delayed)|تقليدية (مؤجلة)','immediate|Immediate placement|فورية','provisional|Immediate with provisional|فورية مع تعويض مؤقت'),
   text('lot','Lot / Batch no.','رقم الدفعة',false),text('serial','Serial no.','الرقم التسلسلي',false),text('udi','UDI (optional)','الرقم العالمي (اختياري)',false),
   number('torque','Insertion torque (Ncm)','عزم الإدخال (نيوتن سم)',0,150,false),number('isq','ISQ (optional)','مقياس الثبات (اختياري)',0,100,false),
   radio('stability','Stability','ثبات الغرسة','good|Primary stability (good)|ثبات أولي جيد','low|Primary stability (low)|ثبات أولي منخفض','unstable|Not stable|غير مستقرة'),
   radio('component','Healing abutment / Cover screw','دعامة الالتئام / غطاء الغرسة','cover|Cover screw|غطاء الغرسة','healing|Healing abutment|دعامة الالتئام'),
   text('componentType','Component type','نوع الدعامة / الغطاء',false),number('componentHeight','Height (mm)','الارتفاع (مم)',0.1,20,false),
   {key:'graftEnabled',en:'Bone grafting (optional)',ar:'تطعيم عظمي (اختياري)',kind:'toggle',wide:true},
   {...text('graftMaterial','Material / Product','المادة / المنتج'),when:['graftEnabled',true]},
   {...select('graftType','Graft type','نوع الطعم','autograft|Autograft|ذاتي','allograft|Allograft|بشري','xenograft|Xenograft|حيواني','synthetic|Synthetic|صناعي','other|Other|أخرى'),when:['graftEnabled',true]},
   {...number('graftQuantity','Quantity','الكمية',0.01,1000),when:['graftEnabled',true]},
   {...select('graftUnit','Unit','الوحدة','cc|cc|سم³','g|g|جم'),when:['graftEnabled',true]},
   {...text('graftLot','Graft lot no.','رقم دفعة الطعم',false),when:['graftEnabled',true]},
   checks('procedures','Additional procedures (optional)','إجراءات إضافية (اختياري)','sinus|Sinus lift|رفع الجيب الأنفي','membrane|Membrane|غشاء حاجز','prf|PRF / PRP|بلازما غنية بالصفائح','soft|Soft tissue graft|تطعيم نسيج رخو','other|Other|أخرى'),notes()],
  [date(),radio('healingType','Healing type','نوع الالتئام','submerged|Submerged (cover screw)|مغطى (غطاء الغرسة)','transmucosal|Transmucosal (healing abutment)|مكشوف (دعامة الالتئام)'),
   radio('status','Healing status','حالة الالتئام','normal|Normal healing|التئام طبيعي','delayed|Delayed healing|التئام متأخر','complication|Complication|مضاعفات'),
   radio('softTissue','Soft tissue condition','حالة الأنسجة الرخوة','healthy|Healthy|جيدة','mild|Mild inflammation|التهاب بسيط','inflamed|Inflammation|التهاب','other|Other|أخرى'),
   radio('mobility','Mobility','حركة الغرسة','none|No mobility|لا توجد حركة','slight|Slight mobility|حركة بسيطة','mobile|Mobile|متحركة'),
   radio('pain','Pain / Discomfort','ألم أو انزعاج','none|None|لا يوجد','mild|Mild|بسيط','moderate|Moderate|متوسط','severe|Severe|شديد'),
   number('probingDepth','Probing depth (mm)','عمق الجيب (مم)',0,20,false),radio('bleeding','Bleeding on probing','نزيف عند الفحص',...yesNo),radio('suppuration','Suppuration','صديد',...yesNo),
   radio('radiograph','Radiographic follow-up','متابعة الأشعة','xray|Periapical X-ray|أشعة حول الذروة','cbct|CBCT|تصوير ثلاثي الأبعاد','none|Not done|لم يتم بعد'),
   radio('boneLevel','Bone level assessment','تقييم مستوى العظم','stable|Stable|مستقر','slight|Slight bone loss|فقد بسيط بالعظم','significant|Significant bone loss|فقد كبير بالعظم','unclear|Not clear|غير واضح'),
   checks('complications','Complications (if any)','مضاعفات (إن وجدت)','peri|Peri-implantitis|التهاب حول الزرعة','overgrowth|Soft tissue overgrowth|زيادة نمو الأنسجة','sinus|Sinus issue|مشكلة بالجيب الأنفي','other|Other|أخرى'),
   radio('nextPlan','Plan for next step','الخطة للخطوة التالية','continue|Continue healing|متابعة الالتئام','expose|Expose implant|كشف الزرعة','prosthetic|Proceed to prosthetic|الانتقال للترميم'),notes()],
  [date(),radio('type','Abutment type','نوع الدعامة','stock|Stock abutment|دعامة قياسية','custom|Custom abutment|دعامة مخصصة','tibase|Titanium base (custom crown)|قاعدة تيتانيوم'),
   text('brand','Brand','الشركة'),text('connection','Type / Connection','النوع / الاتصال'),number('height','Abutment height (mm)','ارتفاع الدعامة (مم)',0.1,20),number('angle','Abutment angle (°)','زاوية الدعامة (درجة)',0,90),notes()],
  [radio('scanType','Scan / Impression type','نوع المسح أو الطبعة','digital|Digital scan (intraoral)|مسح رقمي داخل الفم','conventional|Conventional impression|طبعة تقليدية'),
   radio('coping','Scan body / Impression coping','سكان بودي / كوبينغ','scanbody|Scan body (implant level)|سكان بودي المستوى الزرعي','closed|Coping (closed tray)|كوبينغ طبعة مغلقة','open|Coping (open tray)|كوبينغ طبعة مفتوحة'),
   checks('records','Additional records (optional)','سجلات إضافية (اختياري)','opposing|Opposing arch|القوس المقابل','bite|Bite registration|تسجيل الإطباق','photos|Photos|صور فوتوغرافية','face|Face scan|مسح الوجه'),date(),
   select('crownType','Crown type','نوع التركيبة','zirconia|Zirconia|زركونيا','emax|E.max|إي ماكس','pfm|Porcelain fused to metal|بورسلين على معدن','metal|Metal|معدن','other|Other|أخرى'),
   select('shadeSystem','Shade system','نظام اللون','vita|VITA Classical|فيتا كلاسيك','3d|VITA 3D-Master|فيتا ثلاثي الأبعاد','custom|Custom|مخصص'),text('shade','Shade','اللون'),
   radio('delivery','Delivery type','نوع التسليم','inhouse|In-house (same day)|في العيادة (نفس اليوم)','lab|Send to lab|إرسال للمعمل'),
   {...text('laboratory','Laboratory','المعمل'),when:['delivery','lab']},notes()],
  [radio('retention','Crown seating type','طريقة التثبيت','screw|Screw retained|تثبيت بواسطة برغي','cement|Cement retained|تثبيت بواسطة إسمنت'),
   radio('seating','Crown seating','تركيب التركيبة','final|Final crown seating|تركيب التركيبة النهائية','tryin|Try-in only|تجربة فقط','temporary|Temporary crown|تركيبة مؤقتة'),
   radio('occlusion','Occlusion','الإطباق','satisfactory|Satisfactory|مناسب','minor|Minor adjustment|تعديل بسيط','major|Major adjustment|تعديل كبير'),
   radio('stability','Stability','ثبات التركيبة','stable|Stable|مستقرة','slight|Slight mobility|حركة بسيطة','unstable|Not stable|غير مستقرة'),date(),
   {...text('cement','Cement type (if cemented)','نوع الإسمنت في حال التثبيت بالإسمنت'),when:['retention','cement']},
   checks('procedures','Additional procedures (optional)','إجراءات إضافية (اختياري)','tighten|Tightening screw|شد البرغي','seal|Seal access hole|إغلاق فتحة الوصول','adjust|Occlusal adjustment|تعديل الإطباق','other|Other|أخرى'),notes()],
  [date(),radio('healing','Healing / Soft tissue status','حالة الأنسجة الرخوة والالتئام','excellent|Excellent|ممتازة','good|Good|جيدة','attention|Needs attention|تحتاج متابعة'),
   radio('crown','Implant / Crown status','حالة الزرعة / التركيبة','stable|Stable|مستقرة','discomfort|Mild discomfort|انزعاج بسيط','adjustment|Needs adjustment|تحتاج تعديل'),
   radio('occlusion','Occlusion review','مراجعة الإطباق','satisfactory|Satisfactory|مناسب','minor|Minor adjustment needed|يحتاج تعديل بسيط','review|Further review needed|يحتاج مراجعة إضافية'),
   radio('hygiene','Hygiene / Patient compliance','النظافة والتزام المريض','good|Good|جيد','reinforce|Needs reinforcement|يحتاج تعزيز'),
   checks('complications','Complications (optional)','مضاعفات (اختياري)','food|Food trap|انحشار الطعام','screw|Screw loosening|ارتخاء البرغي','cement|Cement excess|زيادة الإسمنت','soft|Soft tissue inflammation|التهاب الأنسجة','other|Other|أخرى'),notes(),
   radio('outcome','Overall restoration outcome','الحالة النهائية','successful|Successful|ناجحة','monitor|Needs monitoring|تحتاج متابعة','intervention|Needs intervention|تحتاج تدخل')],
];
export function emptyImplantWorkflow(): ImplantWorkflow { return {schemaVersion:1,planning:{},placement:{},healingVisits:[],abutment:{},scan:{},fixation:{},followupVisits:[]}; }
export function visibleImplantFields(stage:number,data:ImplantData): ImplantField[] { return implantFields[stage].filter(f => !f.when || data[f.when[0]] === f.when[1]); }
export interface ImplantGroup { en?:string; ar?:string; fields:ImplantField[]; span:number; }
export function implantGroups(stage:number,data:ImplantData):ImplantGroup[] {
  const fields=visibleImplantFields(stage,data);
  const groups:ImplantGroup[]=[]; const used=new Set<string>();
  const group=(keys:string[],en?:string,ar?:string,span=1)=>{ const selected=fields.filter(f=>keys.includes(f.key)); selected.forEach(f=>used.add(f.key)); if(selected.length)groups.push({en,ar,fields:selected,span}); };
  if(stage===1) {
    group(['brand','system','model','connection'],'Implant Brand / System','الشركة ونظام الزراعة',2);
    group(['diameter','length'],'Implant Size','مقاسات الغرسة'); group(['placementType']);
    group(['lot','serial','udi'],'Implant Identification','بيانات التعريف',2);group(['torque','isq'],'Surgical Measurements','قياسات الجراحة');group(['stability']);
    group(['component','componentType','componentHeight'],'Healing Abutment / Cover Screw','دعامة الالتئام / غطاء الغرسة');
    group(['graftEnabled','graftMaterial','graftType','graftQuantity','graftUnit','graftLot'],'Bone Grafting (optional)','تطعيم عظمي (اختياري)',4);
    group(['procedures'],undefined,undefined,2); group(['notes'],undefined,undefined,2);
  } else if(stage===2) {
    for(const key of ['healingType','status','softTissue','mobility','pain'])group([key]);
    group(['probingDepth','bleeding','suppuration'],'Clinical Examination','الفحص السريري',2);group(['radiograph']);group(['boneLevel']);group(['complications']);group(['nextPlan'],undefined,undefined,2);group(['notes'],undefined,undefined,2);
  } else if(stage===3) {
    group(['type']);group(['brand','connection'],'Abutment Details','بيانات الدعامة');group(['height','angle'],'Abutment Dimensions','أبعاد الدعامة');group(['notes'],undefined,undefined,2);
  } else if(stage===4) {
    for(const key of ['scanType','coping','records','date','crownType'])group([key]);
    group(['shadeSystem','shade'],'Shade','لون التركيبة');group(['laboratory']);group(['delivery']);group(['notes'],undefined,undefined,2);
  } else if(stage===5) {
    for(const key of ['retention','seating','occlusion','stability','date','cement','procedures'])group([key]);group(['notes'],undefined,undefined,2);
  } else if(stage===6) {
    for(const key of ['healing','crown','occlusion','hygiene','complications'])group([key]);group(['notes'],undefined,undefined,2);group(['outcome']);
  }
  for(const field of fields) if(!used.has(field.key) && !(field.key==='date' && [1,2,3,6].includes(stage))) groups.push({fields:[field],span:field.wide?4:1});
  return groups;
}
export function implantValidation(stage:number,data:ImplantData): string | null {
  for (const f of visibleImplantFields(stage,data)) {
    const value = data[f.key];
    if (f.required && (value === undefined || value === null || String(value).trim() === '')) return f.ar;
    if (f.kind === 'number' && value !== undefined && value !== null && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < f.min! || Number(value) > f.max!)) return f.ar;
  }
  return null;
}
export function followupDate(date:string,interval:string):string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || interval === 'custom') return '';
  const [y,m,d] = date.split('-').map(Number); const result = new Date(Date.UTC(y,m-1,d));
  if (interval.endsWith('w')) result.setUTCDate(d + Number(interval.slice(0,-1))*7);
  else { result.setUTCDate(1); result.setUTCMonth(m-1+Number(interval.slice(0,-1))); result.setUTCDate(Math.min(d,new Date(Date.UTC(result.getUTCFullYear(),result.getUTCMonth()+1,0)).getUTCDate())); }
  return result.toISOString().slice(0,10);
}
