import { ImplantField, ImplantOption } from './implant-fields';
const opts=(...values:string[]):ImplantOption[]=>values.map(v=>{const [value,en,ar]=v.split('|');return {value,en,ar};});
const radio=(key:string,en:string,ar:string,...values:string[]):ImplantField=>({key,en,ar,kind:'radio',required:true,options:opts(...values)});
export const vitaShades=['A1','A2','A3','A3.5','A4','B1','B2','B3','B4','C1','C2','C3','C4','D2','D3','D4'];
export const scalingAssessment:ImplantField[]=[
 radio('scope','Teeth to be scaled','نطاق التنظيف','full|Full mouth|الفم كامل','upper|Upper arch|الفك العلوي','lower|Lower arch|الفك السفلي','quadrants|Selected quadrants|مناطق محددة'),
 {key:'quadrants',en:'Selected quadrants',ar:'اختر منطقة أو أكثر',kind:'checks',when:['scope','quadrants'],options:opts('UR|Upper right|العلوي الأيمن','UL|Upper left|العلوي الأيسر','LR|Lower right|السفلي الأيمن','LL|Lower left|السفلي الأيسر')},
 radio('calculus','Calculus amount','كمية الجير','mild|Mild|بسيط','moderate|Moderate|متوسط','heavy|Heavy|كثيف'),
 radio('gingivalStatus','Gingival status','حالة اللثة','healthy|Healthy|سليمة','mild|Mild gingivitis|التهاب بسيط','moderate|Moderate gingivitis|التهاب متوسط','suspected-periodontitis|Suspected periodontitis / Refer|اشتباه يحتاج تقييم دواعم الأسنان'),
 {key:'scalingPerformed',en:'Scaling performed',ar:'تم إجراء التنظيف اليوم',kind:'checks',options:[]},
 {key:'equipment',en:'Technique / Equipment (optional)',ar:'الطريقة والأدوات (اختياري)',kind:'checks',options:opts('ultrasonic|Ultrasonic scaler|جهاز الموجات فوق الصوتية','hand|Hand scaling|تنظيف يدوي','other|Other|أخرى')},
 radio('pocketMapping','Periodontal pocket mapping needed?','هل توجد جيوب لثوية تحتاج تسجيل؟','no|No|لا','yes|Yes|نعم'),
 {key:'assessmentNotes',en:'Notes (optional)',ar:'ملاحظات التقييم (اختياري)',kind:'notes',wide:true},
];
export const scalingFinal:ImplantField[]=[
 radio('polishing','Polishing performed','إجراء التلميع','yes|Yes|نعم','no|No|لا','not-indicated|Not indicated|غير مطلوب'),
 {...radio('polishingMaterial','Polishing material','مادة التلميع','paste|Prophylaxis paste|معجون التلميع','air|Air polishing|التلميع الهوائي','other|Other|أخرى'),when:['polishing','yes']},
 {...radio('fluoride','Fluoride application (optional)','تطبيق الفلورايد (اختياري)','yes|Yes|نعم','no|No|لا','not-indicated|Not indicated|غير مطلوب'),required:false},
 radio('sensitivity','Post-scaling sensitivity','الحساسية بعد التنظيف','none|None|لا توجد','mild|Mild|بسيطة','moderate|Moderate|متوسطة','severe|Severe|شديدة'),
 radio('recall','Follow-up / Recall','المتابعة','none|No recall needed|لا حاجة للمتابعة','1m|1 month|شهر','3m|3 months|٣ أشهر','6m|6 months|٦ أشهر','custom|Custom|تحديد يدوي'),
 {key:'additionalNotes',en:'Additional notes (optional)',ar:'ملاحظات إضافية (اختياري)',kind:'notes',wide:true},
];
export const pocketFields:ImplantField[]=[
 {...radio('treatment','Treatment for pocket (optional)','علاج الجيوب اللثوية (اختياري)','srp|Scaling & root planing (SRP)|تنظيف وتخطيط الجذور','chlorhexidine|Chlorhexidine gel|جل الكلورهيكسيدين','local-antimicrobial|Local antimicrobial|مضاد موضعي','systemic-antibiotics|Systemic antibiotics|مضاد جهازي','referral|Periodontal surgery referral|إحالة لجراحة اللثة','other|Other|أخرى'),required:false},
 radio('treatmentStatus','Treatment status','حالة العلاج','planned|Planned|مخطط','performed|Performed today|تم اليوم'),
 {key:'product',en:'Product / concentration / instructions',ar:'المنتج والتركيز وطريقة الاستخدام',kind:'text'},
 {key:'notes',en:'Treatment notes (optional)',ar:'ملاحظات علاج السن',kind:'notes'},
];
export const bleachingFields:ImplantField[]=[
 {key:'durationMinutes',en:'Session duration (minutes)',ar:'مدة هذه الجلسة بالدقائق',kind:'number',required:true,min:1,max:480},
 {key:'shadeAfter',en:'Shade after bleaching',ar:'لون الأسنان بعد هذه الجلسة',kind:'select',required:true,options:vitaShades.map(s=>({value:s,en:s,ar:s}))},
 radio('sensitivity','Post-bleaching sensitivity','الحساسية بعد التبييض','none|None|لا توجد','mild|Mild|بسيطة','moderate|Moderate|متوسطة','severe|Severe|شديدة'),
 {key:'sensitivityNotes',en:'Notes (optional)',ar:'الأعراض أو الإجراءات المتخذة (اختياري)',kind:'notes'},
];
export const instructionTemplates={
 scaling:{ar:'نظّف أسنانك بالفرشاة بلطف حسب إرشادات طبيبك.\nاستخدم وسيلة تنظيف بين الأسنان بالطريقة التي شرحها الطبيب.\nالتزم بموعد المتابعة الذي حدده الطبيب.',en:'Brush gently as instructed by your dentist.\nUse the interdental cleaning method demonstrated by your dentist.\nAttend the follow-up arranged with your dentist.'},
 bleaching:{ar:'التزم بتعليمات الطبيب والمنتج المستخدم في التبييض.\nتواصل مع العيادة إذا استمرت الحساسية أو ظهرت أعراض غير معتادة.\nلا تغيّر مدة استخدام المادة أو تركيزها دون مراجعة الطبيب.',en:'Follow your dentist’s instructions and the instructions for the bleaching product used.\nContact the clinic for persistent sensitivity or unusual symptoms.\nDo not change application time or concentration without consulting your dentist.'}
};
