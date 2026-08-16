/* ============================================================
   18) دليل التخصصات — قاعدة بيانات مصغّرة تعريفية
   ============================================================ */
const SPECIALTIES = [
    { id:"medicine", icon:"fa-user-doctor", track:"science",
      ar:{name:"الطب البشري", desc:"دراسة تشخيص وعلاج الأمراض، 6 سنوات + امتياز.", career:"طبيب عام أو أخصائي بعد التدريب.", note:"من أعلى التخصصات تنافسية؛ يتطلب STEP في أغلب الجامعات.",
          outlook:"حاجة دائمة لا تنقطع، مع نمو ملحوظ في تخصصات الجراحة الدقيقة والأورام والطب الجيني.",
          branches:["الطب الباطني","الجراحة","طب الأطفال","النساء والولادة","الطب النفسي","طب الطوارئ"],
          universities:["جامعة الملك سعود","جامعة الملك عبدالعزيز","جامعة الملك سعود بن عبدالعزيز للعلوم الصحية","جامعة الملك فيصل"]},
      en:{name:"Medicine", desc:"Diagnosing and treating illness, 6 years + internship.", career:"General practitioner or specialist after training.", note:"One of the most competitive majors; STEP is required at most universities.",
          outlook:"Demand never stops, with notable growth in precision surgery, oncology, and genetic medicine.",
          branches:["Internal Medicine","Surgery","Pediatrics","OB/GYN","Psychiatry","Emergency Medicine"],
          universities:["King Saud University","King Abdulaziz University","KSAU-HS","King Faisal University"]} },
    { id:"dentistry", icon:"fa-tooth", track:"science",
      ar:{name:"طب الأسنان", desc:"دراسة صحة الفم والأسنان وعلاجها جراحياً وتحفظياً.", career:"طبيب أسنان عام أو أخصائي.", note:"تنافسية عالية، غالباً تتطلب STEP.",
          outlook:"مستقر مع توسع القطاع الخاص والتقنيات الحديثة لتقويم وزراعة الأسنان."},
      en:{name:"Dentistry", desc:"Oral and dental health, surgical and conservative treatment.", career:"General or specialist dentist.", note:"Highly competitive, usually requires STEP.",
          outlook:"Stable field, growing with private-sector expansion and modern orthodontic/implant technology."} },
    { id:"pharmacy", icon:"fa-pills", track:"science",
      ar:{name:"الصيدلة", desc:"دراسة الأدوية وتركيبها وتأثيرها العلاجي.", career:"صيدلي في مستشفى، صيدلية، أو صناعة دوائية.", note:"تنافسية عالية جداً.",
          outlook:"نمو في أبحاث الدواء والتصنيع المحلي للقاحات والأدوية."},
      en:{name:"Pharmacy", desc:"Study of drugs, formulation, and therapeutic effects.", career:"Pharmacist in hospitals, pharmacies, or the pharma industry.", note:"Very competitive.",
          outlook:"Growth in drug research and local manufacturing of vaccines and medicines."} },
    { id:"engineering_cs", icon:"fa-microchip", track:"science",
      ar:{name:"هندسة/علوم الحاسب", desc:"برمجة، خوارزميات، أنظمة، وذكاء اصطناعي.", career:"مطوّر برمجيات، مهندس بيانات، أمن سيبراني.", note:"طلب سوقي مرتفع جداً حالياً.",
          branches:["الذكاء الاصطناعي وتعلم الآلة","أمن المعلومات","هندسة البرمجيات","علم البيانات","الشبكات وأنظمة التشغيل"],
          universities:["جامعة الملك فهد للبترول والمعادن","جامعة الملك سعود","جامعة الملك عبدالعزيز","جامعة الأميرة نورة"]},
      en:{name:"Computer Science/Engineering", desc:"Programming, algorithms, systems, and AI.", career:"Software developer, data engineer, cybersecurity.", note:"Very high market demand currently.",
          branches:["AI & Machine Learning","Cybersecurity","Software Engineering","Data Science","Networks & OS"],
          universities:["KFUPM","King Saud University","King Abdulaziz University","Princess Nourah University"]} },
    { id:"engineering_civil", icon:"fa-drafting-compass", track:"science",
      ar:{name:"الهندسة المدنية", desc:"تصميم وإنشاء الطرق والمباني والبنية التحتية.", career:"مهندس مواقع، استشاري إنشائي.", note:"طلب مستقر مرتبط بمشاريع البنية التحتية."},
      en:{name:"Civil Engineering", desc:"Designing roads, buildings, and infrastructure.", career:"Site engineer, structural consultant.", note:"Steady demand tied to infrastructure projects."} },
    { id:"business", icon:"fa-briefcase", track:"admin",
      ar:{name:"إدارة الأعمال", desc:"إدارة، تسويق، موارد بشرية، وريادة أعمال.", career:"مدير مشروع، مسوّق، رائد أعمال.", note:"تخصص واسع بفرص متنوعة.",
          branches:["التسويق","الموارد البشرية","إدارة المشاريع","ريادة الأعمال","الأعمال الدولية"],
          universities:["جامعة الملك سعود","جامعة الملك فهد للبترول والمعادن","جامعة الإمام محمد بن سعود"]},
      en:{name:"Business Administration", desc:"Management, marketing, HR, entrepreneurship.", career:"Project manager, marketer, entrepreneur.", note:"Broad field with diverse opportunities.",
          branches:["Marketing","HR","Project Management","Entrepreneurship","International Business"],
          universities:["King Saud University","KFUPM","Imam Mohammad Ibn Saud University"]} },
    { id:"accounting", icon:"fa-calculator", track:"admin",
      ar:{name:"المحاسبة", desc:"القياس والتقارير المالية والمراجعة.", career:"محاسب قانوني، مراجع داخلي، محلل مالي.", note:"طلب ثابت في كل القطاعات تقريباً.",
          outlook:"تخصص جوهري لا تخلو منه أي شركة، مع ضرورة متزايدة للإلمام بالأنظمة المحاسبية الرقمية."},
      en:{name:"Accounting", desc:"Financial measurement, reporting, and auditing.", career:"Certified accountant, internal auditor, financial analyst.", note:"Steady demand across nearly all sectors.",
          outlook:"A core function every company needs, with growing importance placed on digital accounting systems."} },
    { id:"finance", icon:"fa-chart-line", track:"admin",
      ar:{name:"التمويل والاستثمار", desc:"الأسواق المالية، إدارة المحافظ، والتحليل المالي.", career:"محلل مالي، مستشار استثمار.", note:"مرتبط بقطاع البنوك والأسواق المالية المتنامي.",
          outlook:"نمو قوي في التقنية المالية (FinTech)، التحليل المالي، وإدارة المخاطر."},
      en:{name:"Finance & Investment", desc:"Financial markets, portfolio management, analysis.", career:"Financial analyst, investment advisor.", note:"Tied to the growing banking and capital-markets sector.",
          outlook:"Strong growth in FinTech, financial analysis, and risk management."} },
    { id:"law", icon:"fa-scale-balanced", track:"humanities",
      ar:{name:"القانون", desc:"دراسة الأنظمة القانونية والتشريعات.", career:"محامٍ، مستشار قانوني، قاضٍ (بعد مسار مختص).", note:"يتطلب اجتياز اختبار الرخصة القانونية للممارسة.",
          outlook:"واعد جداً في القوانين التجارية، الأمن السيبراني، حماية البيانات، والملكية الفكرية.",
          branches:["القانون التجاري","القانون الجنائي","القانون الدولي","التحكيم التجاري"],
          universities:["جامعة الملك سعود","جامعة الإمام محمد بن سعود","جامعة الملك عبدالعزيز"]},
      en:{name:"Law", desc:"Study of legal systems and legislation.", career:"Lawyer, legal consultant, judge (via a specialized path).", note:"Requires passing the legal licensing exam to practice.",
          outlook:"Very promising in commercial law, cybersecurity, data protection, and intellectual property.",
          branches:["Commercial Law","Criminal Law","International Law","Commercial Arbitration"],
          universities:["King Saud University","Imam Mohammad Ibn Saud University","King Abdulaziz University"]} },
    { id:"sharia", icon:"fa-mosque", track:"humanities",
      ar:{name:"الشريعة والدراسات الإسلامية", desc:"الفقه، أصول الفقه، والدراسات الشرعية.", career:"قاضٍ شرعي، إمام وخطيب، باحث شرعي، تدريس.", note:"عادة لا تتطلب STEP؛ بعض الكليات تشترط اختبار تلاوة/حفظ."},
      en:{name:"Sharia & Islamic Studies", desc:"Islamic jurisprudence and its foundations.", career:"Sharia judge, imam, researcher, teaching.", note:"Usually no STEP requirement; some colleges require a recitation/memorization test."} },
    { id:"education", icon:"fa-chalkboard-user", track:"humanities",
      ar:{name:"التربية وطرق التدريس", desc:"إعداد معلمين لمختلف المراحل الدراسية.", career:"معلم، مشرف تربوي، أخصائي مناهج.", note:"طلب مستقر مرتبط بوزارة التعليم."},
      en:{name:"Education", desc:"Preparing teachers for various school stages.", career:"Teacher, educational supervisor, curriculum specialist.", note:"Steady demand tied to the Ministry of Education."} },
    { id:"arabic", icon:"fa-feather", track:"humanities",
      ar:{name:"اللغة العربية وآدابها", desc:"النحو، الأدب، البلاغة، واللسانيات.", career:"تدريس، تحرير، إعلام، ترجمة.", note:"عادة لا تتطلب STEP."},
      en:{name:"Arabic Language & Literature", desc:"Grammar, literature, rhetoric, and linguistics.", career:"Teaching, editing, media, translation.", note:"Usually no STEP requirement."} },
    { id:"english_translation", icon:"fa-language", track:"humanities",
      ar:{name:"اللغة الإنجليزية والترجمة", desc:"إتقان اللغة الإنجليزية وأصول الترجمة.", career:"مترجم، تدريس، إعلام، علاقات دولية.", note:"غالباً تتطلب درجة STEP مرتفعة نسبياً.",
          outlook:"تركيز متزايد على الترجمة الفورية، الترجمة القانونية والطبية، وحتى تدريب نماذج الذكاء الاصطناعي اللغوية."},
      en:{name:"English & Translation", desc:"English fluency and translation principles.", career:"Translator, teaching, media, international relations.", note:"Usually requires a relatively high STEP score.",
          outlook:"Growing focus on simultaneous interpretation, legal/medical translation, and even training AI language models."} },
    { id:"nursing", icon:"fa-user-nurse", track:"science",
      ar:{name:"التمريض", desc:"الرعاية الصحية للمرضى في مختلف الأقسام الطبية.", career:"ممرض/ة في مستشفيات حكومية وخاصة.", note:"طلب سوقي مرتفع ومستقر."},
      en:{name:"Nursing", desc:"Patient care across medical departments.", career:"Nurse in public and private hospitals.", note:"High and steady market demand."} },
    { id:"architecture", icon:"fa-building", track:"science",
      ar:{name:"العمارة", desc:"تصميم المباني من الناحية الجمالية والوظيفية.", career:"مهندس معماري، مصمم داخلي، مخطط عمراني.", note:"يتطلب موهبة تصميمية إلى جانب الأساس الهندسي."},
      en:{name:"Architecture", desc:"Designing buildings aesthetically and functionally.", career:"Architect, interior designer, urban planner.", note:"Requires design talent alongside engineering fundamentals."} },
    { id:"psychology", icon:"fa-brain", track:"humanities",
      ar:{name:"علم النفس", desc:"دراسة السلوك الإنساني والعمليات النفسية.", career:"أخصائي نفسي (بعد ترخيص)، موارد بشرية، بحث علمي.", note:"يحتاج غالباً دراسات عليا للممارسة الإكلينيكية.",
          outlook:"ارتفاع ملحوظ في الوعي بالصحة النفسية وجودة الحياة وبيئة العمل، وطلب متزايد على علم النفس التنظيمي في الشركات."},
      en:{name:"Psychology", desc:"Study of human behavior and mental processes.", career:"Licensed psychologist, HR, research.", note:"Clinical practice usually requires graduate studies.",
          outlook:"Rising awareness of mental health and workplace well-being, with growing demand for organizational psychology in companies."} },
    { id:"industrial_eng", icon:"fa-industry", track:"science",
      ar:{name:"الهندسة الصناعية", desc:"تحسين العمليات الإنتاجية وسلاسل الإمداد وإدارة الجودة.", career:"مهندس عمليات، مستشار سلاسل إمداد.", note:"مطلوبة في القطاع الصناعي واللوجستي المتنامي.",
          outlook:"طلب كبير في إدارة العمليات، اللوجستيات، وتوجيه المشاريع مع التحول نحو المصانع الذكية."},
      en:{name:"Industrial Engineering", desc:"Optimizing production processes, supply chains, and quality.", career:"Process engineer, supply-chain consultant.", note:"In demand across the growing industrial and logistics sector.",
          outlook:"High demand in operations management, logistics, and project leadership amid the shift toward smart factories."} },
    { id:"petroleum_eng", icon:"fa-oil-well", track:"science",
      ar:{name:"هندسة البترول", desc:"استكشاف واستخراج النفط والغاز.", career:"مهندس حفر، مهندس مكامن.", note:"مرتبطة تاريخياً بأرامكو وقطاع الطاقة."},
      en:{name:"Petroleum Engineering", desc:"Oil and gas exploration and extraction.", career:"Drilling engineer, reservoir engineer.", note:"Historically tied to Aramco and the energy sector."} },
    { id:"media", icon:"fa-video", track:"humanities",
      ar:{name:"الإعلام والاتصال", desc:"الصحافة، الإعلام الرقمي، والعلاقات العامة.", career:"صحفي، منتج محتوى، مسؤول علاقات عامة.", note:"تطوّر كثيراً مع نمو الإعلام الرقمي ووسائل التواصل.",
          outlook:"الاعتماد المتزايد على المهارات الفردية والإنتاج الرقمي والمنصات الحديثة بدل الإعلام التقليدي وحده."},
      en:{name:"Media & Communication", desc:"Journalism, digital media, and public relations.", career:"Journalist, content producer, PR officer.", note:"Growing rapidly alongside digital media and social platforms.",
          outlook:"Increasing reliance on individual skills, digital production, and modern platforms rather than traditional media alone."} },
    { id:"veterinary", icon:"fa-paw", track:"science",
      ar:{name:"الطب البيطري", desc:"تشخيص وعلاج أمراض الحيوانات.", career:"طبيب بيطري في عيادات أو قطاع الثروة الحيوانية.", note:"تخصص متوسط التنافسية نسبياً."},
      en:{name:"Veterinary Medicine", desc:"Diagnosing and treating animal illnesses.", career:"Veterinarian in clinics or the livestock sector.", note:"Moderately competitive."} },

    { id:"ai_ml", icon:"fa-robot", track:"science",
      ar:{name:"الذكاء الاصطناعي وتعلم الآلة", desc:"بناء الأنظمة الذكية، تحليل البيانات الضخمة، والتعلم الآلي.", career:"مهندس ذكاء اصطناعي، مطوّر نماذج تعلم آلي، باحث.", note:"من أسرع التخصصات نمواً عالمياً ومحلياً.",
          outlook:"المحرك الأساسي لكافة التكنولوجيا القادمة — روبوتات، تحليل تنبؤي، وأتمتة."},
      en:{name:"AI & Machine Learning", desc:"Building intelligent systems, big-data analysis, and machine learning.", career:"AI engineer, ML model developer, researcher.", note:"One of the fastest-growing fields globally and locally.",
          outlook:"The core driver of all upcoming technology — robotics, predictive analytics, and automation."} },
    { id:"cybersecurity", icon:"fa-shield-halved", track:"science",
      ar:{name:"الأمن السيبراني", desc:"حماية الأنظمة، الشبكات، والبيانات من الهجمات الرقمية.", career:"محلل أمن معلومات، مختبر اختراق، مستشار أمني.", note:"طلب سوقي مرتفع جداً حالياً.",
          outlook:"طلب حاد ومستمر لا يستغني عنه أي قطاع حكومي أو خاص."},
      en:{name:"Cybersecurity", desc:"Protecting systems, networks, and data from digital attacks.", career:"Security analyst, penetration tester, security consultant.", note:"Very high current market demand.",
          outlook:"Sharp, continuous demand that no government or private sector can do without."} },
    { id:"data_science", icon:"fa-database", track:"science",
      ar:{name:"علوم البيانات وتحليلها", desc:"استخراج المعرفة والأنماط من الكميات الهائلة من البيانات.", career:"محلل بيانات، عالم بيانات، مستشار تحليلات.", note:"طلب متنامٍ بسرعة مع تحول الشركات للقرارات المبنية على بيانات.",
          outlook:"عصب اتخاذ القرار في الشركات، التسويق، والتخطيط الاستراتيجي."},
      en:{name:"Data Science & Analytics", desc:"Extracting knowledge and patterns from massive amounts of data.", career:"Data analyst, data scientist, analytics consultant.", note:"Rapidly growing demand as companies shift to data-driven decisions.",
          outlook:"The backbone of decision-making in companies, marketing, and strategic planning."} },
    { id:"cloud_computing", icon:"fa-cloud", track:"science",
      ar:{name:"الحوسبة السحابية وشبكات الحاسب", desc:"إدارة السيرفرات والبنية التحتية الرقمية.", career:"مهندس سحابة، مدير شبكات، مهندس DevOps.", note:"نمو متزايد مع تحوّل الشركات للسحابة.",
          outlook:"نمو متزايد مع تحول معظم الشركات من السيرفرات المحلية إلى السحابة."},
      en:{name:"Cloud Computing & Networking", desc:"Managing servers and digital infrastructure.", career:"Cloud engineer, network administrator, DevOps engineer.", note:"Growing demand as companies migrate to the cloud.",
          outlook:"Increasing growth as most companies shift from local servers to the cloud."} },
    { id:"electrical_eng", icon:"fa-bolt", track:"science",
      ar:{name:"الهندسة الكهربائية والإلكترونية", desc:"الطاقة، الدوائر الإلكترونية، والأنظمة المدمجة.", career:"مهندس كهرباء، مهندس أنظمة مدمجة.", note:"تخصص هندسي أساسي وواسع التطبيقات.",
          outlook:"واعد جداً مع التوجه نحو الطاقة المتجددة، السيارات الكهربائية، وإنترنت الأشياء."},
      en:{name:"Electrical & Electronics Engineering", desc:"Power, electronic circuits, and embedded systems.", career:"Electrical engineer, embedded systems engineer.", note:"A core, broadly-applicable engineering field.",
          outlook:"Very promising with the shift toward renewable energy, electric vehicles, and IoT."} },
    { id:"mechanical_eng", icon:"fa-gears", track:"science",
      ar:{name:"الهندسة الميكانيكية والأتمتة", desc:"المحركات، التصنيع، التكييف، والروبوتات.", career:"مهندس ميكانيكي، مهندس تصنيع، مهندس روبوتات.", note:"تخصص تقليدي يتجدّد مع الأتمتة.",
          outlook:"التحول نحو المصانع الذكية والتصنيع الرقمي المتقدم."},
      en:{name:"Mechanical Engineering & Automation", desc:"Engines, manufacturing, HVAC, and robotics.", career:"Mechanical engineer, manufacturing engineer, robotics engineer.", note:"A traditional field being renewed by automation.",
          outlook:"Shift toward smart factories and advanced digital manufacturing."} },
    { id:"chemical_eng", icon:"fa-flask", track:"science",
      ar:{name:"الهندسة الكيميائية وهندسة المواد", desc:"تكرير الموارد، المواد المتقدمة، والبتروكيماويات.", career:"مهندس كيميائي، مهندس مواد، باحث بتروكيماويات.", note:"مرتبط بقطاع الطاقة والصناعة الثقيلة في السعودية.",
          outlook:"التركيز على أبحاث البطاريات، الهيدروجين الأخضر، والمواد المتقدمة."},
      en:{name:"Chemical & Materials Engineering", desc:"Resource refining, advanced materials, and petrochemicals.", career:"Chemical engineer, materials engineer, petrochemical researcher.", note:"Tied to Saudi Arabia's energy and heavy-industry sector.",
          outlook:"Focus on battery research, green hydrogen, and advanced materials."} },
    { id:"applied_medical", icon:"fa-stethoscope", track:"science",
      ar:{name:"العلوم الطبية التطبيقية", desc:"الأشعة، المختبرات، العلاج الطبيعي، والتخدير.", career:"أخصائي أشعة، فني مختبر، أخصائي علاج طبيعي.", note:"طلب مستقر في المستشفيات والمراكز الطبية.",
          outlook:"طلب مرتقب لزيادة الاستثمار في المستشفيات والمراكز التأهيلية."},
      en:{name:"Applied Medical Sciences", desc:"Radiology, lab sciences, physical therapy, and anesthesia technology.", career:"Radiology tech, lab technician, physical therapist.", note:"Steady demand across hospitals and medical centers.",
          outlook:"Anticipated demand growth as investment in hospitals and rehab centers increases."} },
    { id:"health_informatics", icon:"fa-hospital-user", track:"science",
      ar:{name:"الإدارة والمعلوماتية الصحية", desc:"إدارة المستشفيات والسجلات الطبية والذكاء الاصطناعي الطبي.", career:"مدير معلومات صحية، محلل نظم طبية.", note:"تخصص يجمع بين الصحة والتقنية.",
          outlook:"من أكثر التخصصات نمواً لربط القطاع الصحي بالتحول الرقمي."},
      en:{name:"Health Informatics & Management", desc:"Hospital administration, medical records, and medical AI.", career:"Health information manager, medical systems analyst.", note:"Combines healthcare with technology.",
          outlook:"One of the fastest-growing fields, connecting healthcare to digital transformation."} },
    { id:"supply_chain", icon:"fa-truck-fast", track:"admin",
      ar:{name:"سلاسل الإمداد والخدمات اللوجستية", desc:"إدارة حركة البضائع والتخزين والتوزيع.", career:"مدير لوجستيات، مخطط سلسلة إمداد.", note:"مرتبط بنمو التجارة الإلكترونية في السعودية.",
          outlook:"طلب مرتفع جداً بسبب التوسع في التجارة الإلكترونية والمراكز اللوجستية العالمية."},
      en:{name:"Supply Chain & Logistics", desc:"Managing the movement, storage, and distribution of goods.", career:"Logistics manager, supply-chain planner.", note:"Tied to the growth of e-commerce in Saudi Arabia.",
          outlook:"Very high demand due to e-commerce expansion and global logistics hubs."} },
    { id:"digital_marketing", icon:"fa-bullhorn", track:"admin",
      ar:{name:"التسويق الرقمي والتجارة الإلكترونية", desc:"الاستراتيجيات التسويقية وتحليل سلوك المستهلك الرقمي.", career:"أخصائي تسويق رقمي، مدير تجارة إلكترونية.", note:"من أكثر المهارات المطلوبة حالياً في سوق العمل.",
          outlook:"التحول الكامل نحو التسويق المبني على البيانات والمحتوى الرقمي."},
      en:{name:"Digital Marketing & E-commerce", desc:"Marketing strategy and digital consumer-behavior analysis.", career:"Digital marketing specialist, e-commerce manager.", note:"One of the most in-demand skill sets in today's job market.",
          outlook:"A full shift toward data-driven marketing and digital content."} },
    { id:"mis", icon:"fa-diagram-project", track:"admin",
      ar:{name:"نظم المعلومات الإدارية", desc:"الجسر الفاصل بين الإدارة وحلول تقنية المعلومات.", career:"محلل أعمال، مستشار نظم معلومات.", note:"مزيج بين الإدارة والتقنية.",
          outlook:"طلب ممتاز لمساعدة الشركات على اختيار وتطبيق التكنولوجيا المناسبة."},
      en:{name:"Management Information Systems", desc:"The bridge between management and IT solutions.", career:"Business analyst, IT systems consultant.", note:"A blend of management and technology.",
          outlook:"Excellent demand helping companies choose and implement the right technology."} },
    { id:"ui_ux_design", icon:"fa-pen-ruler", track:"humanities",
      ar:{name:"تصميم تجربة وواجهة المستخدم (UI/UX)", desc:"تصميم كيفية تفاعل المستخدم مع التطبيقات والمواقع.", career:"مصمم UI/UX، باحث تجربة مستخدم.", note:"يحتاج غالباً معرض أعمال (Portfolio) قوياً.",
          outlook:"طلب استثنائي في جميع شركات التقنية والشركات الناشئة."},
      en:{name:"UI/UX Design", desc:"Designing how users interact with apps and websites.", career:"UI/UX designer, user researcher.", note:"Usually requires a strong portfolio.",
          outlook:"Exceptional demand across all tech companies and startups."} },
    { id:"graphic_design", icon:"fa-palette", track:"humanities",
      ar:{name:"التصميم الجرافيكي والوسائط المتعددة", desc:"الهويات البصرية والرسوم المتحركة (Motion Graphics).", career:"مصمم جرافيك، فنان موشن جرافيك.", note:"يحتاج معرض أعمال قوياً ومهارة فنية مستمرة التطوير.",
          outlook:"مستمر ومطلوب في صناعة الإعلانات والترفيه والألعاب."},
      en:{name:"Graphic Design & Motion Graphics", desc:"Visual identities and motion graphics.", career:"Graphic designer, motion graphics artist.", note:"Requires a strong portfolio and continuously developing artistic skill.",
          outlook:"Ongoing demand in advertising, entertainment, and gaming."} },
    { id:"interior_design", icon:"fa-couch", track:"humanities",
      ar:{name:"التصميم الداخلي", desc:"استغلال المساحات الداخلية والتنسيق الجمالي.", career:"مصمم داخلي، مستشار ديكور.", note:"مختلف عن الهندسة المعمارية — يركّز على المساحات الداخلية تحديداً.",
          outlook:"مرتبط بالنمو العقاري وتطوير قطاعات الضيافة والسياحة."},
      en:{name:"Interior Design", desc:"Utilizing interior spaces and aesthetic coordination.", career:"Interior designer, decor consultant.", note:"Distinct from architecture — focuses specifically on interior spaces.",
          outlook:"Tied to real-estate growth and the development of hospitality and tourism."} },
    { id:"physics", icon:"fa-atom", track:"science",
      ar:{name:"الفيزياء والفيزياء الطبية والتطبيقية", desc:"دراسة المادة والطاقة والتطبيقات الطبية.", career:"باحث فيزياء، فيزيائي طبي، مهندس تطبيقي.", note:"أساس علمي قوي يفتح أبواباً بحثية وصناعية متعددة.",
          outlook:"مجالات الطاقة، الأبحاث النووية، والتصوير الطبي."},
      en:{name:"Physics & Applied/Medical Physics", desc:"Study of matter, energy, and medical applications.", career:"Physics researcher, medical physicist, applied engineer.", note:"A strong scientific foundation opening many research and industrial doors.",
          outlook:"Energy fields, nuclear research, and medical imaging."} },
    { id:"chemistry", icon:"fa-vial", track:"science",
      ar:{name:"الكيمياء والكيمياء الصناعية", desc:"تحليل المواد والتصنيع الكيميائي.", career:"كيميائي صناعي، باحث مختبرات، مراقب جودة.", note:"مرتبط بالقطاعات الصناعية والدوائية في السعودية.",
          outlook:"القطاعات الصناعية، الدوائية، والبتروكيميائية."},
      en:{name:"Chemistry & Industrial Chemistry", desc:"Material analysis and chemical manufacturing.", career:"Industrial chemist, lab researcher, quality controller.", note:"Tied to Saudi Arabia's industrial and pharmaceutical sectors.",
          outlook:"Industrial, pharmaceutical, and petrochemical sectors."} },
    { id:"biotechnology", icon:"fa-dna", track:"science",
      ar:{name:"التكنولوجيا الحيوية والأحياء الدقيقة", desc:"تعديل الجينات واللقاحات والأبحاث الحيوية.", career:"باحث تقنية حيوية، أخصائي مختبرات وراثية.", note:"مجال بحثي متنامٍ بقوة عالمياً.",
          outlook:"نمو هائل في الطب الحديث والتصنيع الغذائي والزراعي."},
      en:{name:"Biotechnology & Microbiology", desc:"Gene editing, vaccines, and biological research.", career:"Biotech researcher, genetics lab specialist.", note:"A rapidly-growing research field worldwide.",
          outlook:"Huge growth in modern medicine and food/agricultural manufacturing."} },
];

function renderSpecialties(){
    const grid = document.getElementById("specialties-grid");
    if(!grid) return;
    const list = getSpecialties();
    const q = (document.getElementById("spec-search").value || "").trim().toLowerCase();
    const filtered = list.filter(s => !q || (s.ar.name||"").toLowerCase().includes(q) || (s.en.name||"").toLowerCase().includes(q));
    if(!filtered.length){
        grid.innerHTML = `<div class="empty-note">${currentLang==='ar'?'لا توجد نتائج':'No results'}</div>`;
        return;
    }
    grid.innerHTML = filtered.map((s, i) => {
        const d = s[currentLang] || s.ar;
        return `
        <div class="link-card" style="cursor:pointer; align-items:flex-start; text-align:start;" onclick="openSpecialtyDetail('${s.id}')">
            <div class="ic"><i class="fa-solid ${s.icon}"></i></div>
            <b>${d.name}</b>
            <div style="font-size:12.5px; color:var(--text-2); line-height:1.8; margin-top:4px;">${d.desc}</div>
            <div style="font-size:11.5px; color:var(--teal); margin-top:6px;"><i class="fa-solid fa-arrow-trend-up"></i> ${d.career}</div>
            <div style="font-size:10.5px; color:var(--gold); margin-top:8px; font-weight:700;">${currentLang==='ar'?'اضغط لعرض التفاصيل الكاملة':'Tap for full details'} <i class="fa-solid fa-chevron-left rtl-flip"></i></div>
        </div>`;
    }).join("");
}

function openSpecialtyDetail(id){
    const s = getSpecialties().find(x => x.id === id);
    if(!s) return;
    const d = s[currentLang] || s.ar;
    const branches = d.branches || [];
    const unis = d.universities || [];
    const overlay = document.createElement("div");
    overlay.className = "overlay-screen";
    overlay.style.zIndex = "4000";
    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="wizard-card" style="max-width:560px; text-align:start;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="ic" style="width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,var(--gold),#B0812A); color:#fff; display:flex; align-items:center; justify-content:center; font-size:20px;"><i class="fa-solid ${s.icon}"></i></div>
                    <h2 style="font-size:19px;">${d.name}</h2>
                </div>
                <button type="button" class="btn-ghost" onclick="this.closest('.overlay-screen').remove()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <p style="font-size:13.5px; color:var(--text-2); line-height:1.9; margin-bottom:14px;">${d.desc}</p>
            <div class="uni-note" style="margin-bottom:10px;"><b style="color:var(--teal);">${currentLang==='ar'?'المسار الوظيفي: ':'Career path: '}</b>${d.career}</div>
            ${d.outlook ? `<div style="margin-bottom:14px; padding:12px 14px; background:var(--bg-alt); border-radius:12px; border-inline-start:3px solid var(--gold);"><b style="font-size:12.5px; color:var(--text-1);"><i class="fa-solid fa-arrow-trend-up" style="color:var(--gold);"></i> ${currentLang==='ar'?'مستقبل التخصص:':'Career outlook:'}</b><p style="font-size:12.5px; color:var(--text-2); line-height:1.8; margin-top:6px;">${d.outlook}</p></div>` : ""}
            ${branches.length ? `<div style="margin-bottom:14px;"><b style="font-size:13px; color:var(--gold);">${currentLang==='ar'?'يتفرّع منه:':'Branches into:'}</b>
                <ul style="margin:8px 0 0; padding-inline-start:20px; font-size:13px; line-height:2;">${branches.map(b=>`<li>${b}</li>`).join("")}</ul></div>` : ""}
            ${unis.length ? `<div style="margin-bottom:14px;"><b style="font-size:13px; color:var(--gold);">${currentLang==='ar'?'متوفر في جامعات مثل:':'Offered at universities such as:'}</b>
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">${unis.map(u=>`<span class="pill pill-maybe">${u}</span>`).join("")}</div></div>` : ""}
            <div class="uni-note" style="opacity:.7; font-size:11px;">${d.note || ""}</div>
        </div>`;
    document.body.appendChild(overlay);
}

/* ============================================================
   19) المجتمع — لوحة الصدارة / غرفة المذاكرة / حائط الأسئلة
   ------------------------------------------------------------
   جميعها تعتمد على Supabase مباشرة (قراءة عامة، كتابة لمن سجّل دخوله
   حتى لو "مجهولاً" عبر anonymous sign-in). تُهيّأ تلقائياً عند فتح
   صفحة "المجتمع" لتفادي استهلاك الشبكة قبل الحاجة.
   ============================================================ */
let communityInitialized = false;
async function initCommunityIfNeeded(){
    if(communityInitialized || !sb) return;
    communityInitialized = true;
    const shared = localStorage.getItem("khuta_lb_share") === "1";
    const toggle = document.getElementById("lb-share-toggle");
    if(toggle) toggle.checked = shared;
    await refreshLeaderboard();
    await refreshForum();
    await refreshTemplates();
    startPresenceHeartbeat();
}

/* ---------- لوحة الصدارة ---------- */
async function onLeaderboardToggle(){
    const on = document.getElementById("lb-share-toggle").checked;
    localStorage.setItem("khuta_lb_share", on ? "1" : "0");
    const { data: userData } = await sb.auth.getUser();
    const uid = userData && userData.user && userData.user.id;
    if(!uid) return;
    if(on){
        await upsertLeaderboardRow();
    } else {
        await sb.from("leaderboard").delete().eq("id", uid);
    }
    refreshLeaderboard();
}

async function upsertLeaderboardRow(){
    if(!sb) return;
    const { data: userData } = await sb.auth.getUser();
    const uid = userData && userData.user && userData.user.id;
    if(!uid) return;
    const session = getSession();
    const displayName = (session && session.username) || (localStorage.getItem("khuta_name") || (currentLang==='ar'?"طالب مجهول":"Anonymous student"));
    await sb.from("leaderboard").upsert({ id: uid, display_name: displayName, xp: getXP(), updated_at: new Date().toISOString() });
}

async function refreshLeaderboard(){
    const box = document.getElementById("leaderboard-list");
    if(!box || !sb) return;
    const { data, error } = await sb.from("leaderboard").select("id, display_name, xp").order("xp", { ascending:false }).limit(10);
    if(error || !data || !data.length){
        box.innerHTML = `<div class="empty-note">${currentLang==='ar'?'لا يوجد طلاب مشاركون بعد — كن أول من ينضم!':'No participants yet — be the first to join!'}</div>`;
        return;
    }
    box.innerHTML = data.map((row, i) => `
        <div style="display:flex; align-items:center; gap:12px; padding:10px 6px; border-bottom:1px solid var(--border);">
            <b style="width:24px; color:${i<3?'var(--gold)':'var(--text-3)'};">#${i+1}</b>
            <span style="flex:1; font-weight:600;">${getPrestigeFlair(row.xp)}${escapeHtml(row.display_name)}</span>
            <span style="font-family:var(--font-mono); color:var(--gold); font-weight:700;">${row.xp} XP</span>
            ${isAdmin ? `<div class="icon-action" style="width:26px; height:26px; font-size:10px;" title="${currentLang==='ar'?'إزالة من لوحة الصدارة':'Remove from leaderboard'}" onclick="removeLeaderboardEntry('${row.id}')"><i class="fa-solid fa-ban"></i></div>` : ""}
        </div>`).join("");
}

/* رمز مكانة بسيط بجانب الاسم حسب مستوى XP — يمنح رقم XP قيمة اجتماعية
   ظاهرة فعلياً في لوحة الصدارة، وليس مجرد رقم بلا أثر */
function getPrestigeFlair(xp){
    if(xp >= 1000) return '<i class="fa-solid fa-crown" style="color:var(--gold); margin-inline-end:4px;" title="خبير قدرات"></i>';
    if(xp >= 600) return '<i class="fa-solid fa-star" style="color:var(--gold); margin-inline-end:4px;" title="محترف"></i>';
    if(xp >= 300) return '<i class="fa-solid fa-bolt" style="color:var(--teal); margin-inline-end:4px;" title="متمرّس"></i>';
    return '';
}

async function removeLeaderboardEntry(id){
    if(!isAdmin || !sb) return;
    if(!confirm(currentLang==='ar' ? "إزالة هذا الطالب نهائياً من لوحة الصدارة؟" : "Permanently remove this student from the leaderboard?")) return;
    const { error } = await sb.from("leaderboard").delete().eq("id", id);
    if(error){ showToast(currentLang==='ar'?'تعذّرت الإزالة':'Could not remove'); return; }
    showToast(currentLang==='ar' ? "🚫 أُزيل من لوحة الصدارة" : "🚫 Removed from leaderboard");
    refreshLeaderboard();
}

/* ---------- غرفة المذاكرة (حضور حي) ---------- */
/* ---------- غرفة المذاكرة — Realtime Presence (بث لحظي عبر WebSocket) ----------
   بديل أسرع وأخف من الاستطلاع الدوري (polling): يعتمد على ميزة Presence
   المدمجة في Supabase، فيتحدّث العدّاد فوراً عند دخول/خروج أي طالب دون أي
   طلبات متكررة كل 25 ثانية. يتطلب أن يكون Realtime مفعّلاً على مشروعك
   (مفعَّل افتراضياً لكل مشاريع Supabase الجديدة — لا حاجة لإعداد إضافي عادة). */
let presenceChannel = null;
async function startPresenceHeartbeat(){
    if(!sb) return;
    const el = document.getElementById("room-count");
    const dashEl = document.getElementById("dash-room-count");
    try{
        const { data: userData } = await sb.auth.getUser();
        const uid = userData && userData.user && userData.user.id;
        if(!uid) return;
        presenceChannel = sb.channel("khuta-study-room", { config: { presence: { key: uid } } });
        presenceChannel
            .on("presence", { event: "sync" }, () => {
                const state = presenceChannel.presenceState();
                const count = Object.keys(state).length || 1;
                if(el) el.textContent = count;
                if(dashEl) dashEl.textContent = count;
                const liveEl = document.getElementById("live-users-count");
                if(liveEl) liveEl.textContent = count;
            })
            .subscribe(async (status) => {
                if(status === "SUBSCRIBED"){
                    await presenceChannel.track({ online_at: new Date().toISOString() });
                }
            });
    }catch(e){
        // فشل صامت مع بديل ثابت — الميزة الرئيسية للموقع لا تعتمد على هذا العدّاد
        console.error("[خُطى] تعذّر تفعيل الحضور اللحظي (Realtime):", e);
        if(el) el.textContent = "1";
        if(dashEl) dashEl.textContent = "1";
    }
}

/* ---------- حائط الأسئلة السريعة ---------- */
const PIN_FORUM_COST = 30;
const PIN_TEMPLATE_COST = 50;

async function refreshForum(){
    const box = document.getElementById("forum-list");
    if(!box || !sb) return;
    const { data, error } = await sb.from("forum_posts").select("id, author_name, message, created_at, pinned_until").order("created_at", { ascending:false }).limit(20);
    if(error || !data || !data.length){
        box.innerHTML = `<div class="empty-note">${currentLang==='ar'?'لا توجد أسئلة بعد — ابدأ أنت!':'No questions yet — be the first!'}</div>`;
        return;
    }
    const now = Date.now();
    const sorted = [...data].sort((a,b) => {
        const aPinned = a.pinned_until && new Date(a.pinned_until).getTime() > now;
        const bPinned = b.pinned_until && new Date(b.pinned_until).getTime() > now;
        if(aPinned && !bPinned) return -1;
        if(!aPinned && bPinned) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
    });
    box.innerHTML = sorted.map(row => {
        const isPinned = row.pinned_until && new Date(row.pinned_until).getTime() > now;
        return `
        <div class="${isPinned ? 'pinned-template-glow' : ''}" style="padding:10px 10px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; gap:10px; align-items:flex-start; ${isPinned ? 'border-radius:12px; margin-bottom:6px;' : ''}">
            <div style="flex:1;">
                ${isPinned ? `<span style="font-size:10.5px; color:var(--gold); font-weight:700;"><i class="fa-solid fa-thumbtack"></i> ${currentLang==='ar'?'مثبَّت':'Pinned'}</span><br>` : ""}
                <div style="font-size:13.5px;">${escapeHtml(row.message)}</div>
                <div style="font-size:11px; color:var(--text-3); margin-top:4px;">${escapeHtml(row.author_name)} · ${new Date(row.created_at).toLocaleDateString(currentLang==='ar'?"ar-SA":"en-US")}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
                ${!isPinned ? `<button type="button" class="icon-action" title="${currentLang==='ar'?`تثبيت (${PIN_FORUM_COST} XP)`:`Pin (${PIN_FORUM_COST} XP)`}" onclick="pinForumPostWithXP(${row.id})"><i class="fa-solid fa-thumbtack"></i></button>` : ""}
                ${isAdmin ? `<button type="button" class="icon-action" title="${currentLang==='ar'?'حذف (صلاحية مشرف)':'Delete (admin)'}" onclick="deleteForumMessage(${row.id})"><i class="fa-solid fa-trash"></i></button>` : ""}
            </div>
        </div>`;
    }).join("");
}

async function pinForumPostWithXP(id){
    if(!sb) return;
    if(getXP() < PIN_FORUM_COST){
        showToast(currentLang==='ar' ? `تحتاج ${PIN_FORUM_COST} XP على الأقل — لديك ${getXP()} فقط` : `You need at least ${PIN_FORUM_COST} XP — you have ${getXP()}`);
        return;
    }
    if(!confirm(currentLang==='ar' ? `تثبيت هذه الرسالة لأعلى القائمة لـ3 أيام مقابل ${PIN_FORUM_COST} XP؟` : `Pin this message to the top for 3 days for ${PIN_FORUM_COST} XP?`)) return;
    const { error } = await sb.rpc("pin_forum_post", { post_id: id, days: 3 });
    if(error){ showToast(currentLang==='ar'?'تعذّر التثبيت':'Could not pin'); console.error(error); return; }
    setXP(getXP() - PIN_FORUM_COST);
    showToast(currentLang==='ar' ? "📌 تم التثبيت لـ3 أيام" : "📌 Pinned for 3 days");
    refreshForum();
}

async function deleteForumMessage(id){
    if(!sb) return;
    if(!confirm(currentLang==='ar' ? "حذف هذه الرسالة نهائياً؟" : "Permanently delete this message?")) return;
    const { error } = await sb.from("forum_posts").delete().eq("id", id);
    if(error){ showToast(currentLang==='ar'?'تعذّر الحذف':'Could not delete'); return; }
    showToast(currentLang==='ar' ? "🗑️ تم الحذف" : "🗑️ Deleted");
    refreshForum();
}

async function postForumMessage(){
    const input = document.getElementById("forum-input");
    const msg = input.value.trim();
    if(!msg || !sb) return;
    const { data: userData } = await sb.auth.getUser();
    const uid = userData && userData.user && userData.user.id;
    if(!uid) return;
    const session = getSession();
    const name = (session && session.username) || (localStorage.getItem("khuta_name") || (currentLang==='ar'?"طالب":"Student"));
    const { error } = await sb.from("forum_posts").insert({ author_name: name, author_id: uid, message: msg });
    if(!error){ input.value = ""; refreshForum(); }
    else showToast(currentLang==='ar'?'تعذّر النشر':'Could not post');
}

/* ملخّص مقروء لخطة الطالب الحالية — يُستخدم في معاينة النشر وفي بطاقات القوالب */
function getConfigSummary(config, planDays, sessionMinutes){
    const content = getContent();
    const lines = [];
    const verbalLabel = config.customVerbal && config.customVerbal.name
        ? `${currentLang==='ar'?'اللفظي: ':'Verbal: '}${config.customVerbal.name} + ${currentLang==='ar'?'إيهاب':'Ehab'}`
        : `${currentLang==='ar'?'اللفظي: ':'Verbal: '}${currentLang==='ar'?'إيهاب':"Ehab's course"}`;
    lines.push(verbalLabel);

    const quantParts = [];
    if(config.found === "moasser") quantParts.push(currentLang==='ar'?'تأسيس المعاصر':'Al-Moaasir foundation');
    if(config.found === "einstein") quantParts.push(currentLang==='ar'?'تأسيس أينشتاين':'Einstein foundation');
    if(config.tMonsif) quantParts.push(currentLang==='ar'?'المنصف':'Al-Monsif');
    if(config.tMufSec) quantParts.push(currentLang==='ar'?'أقسام المفكر':'Al-Mufakkir sections');
    if(config.tMufRep) quantParts.push(currentLang==='ar'?'تكرارات المفكر':'Al-Mufakkir repeats');
    if(config.tMoasser) quantParts.push(currentLang==='ar'?'بنوك المعاصر':'Al-Moaasir banks');
    if(config.customQuant && config.customQuant.name) quantParts.push(config.customQuant.name);
    lines.push((currentLang==='ar'?'الكمي: ':'Quant: ') + (quantParts.length ? quantParts.join(" + ") : (currentLang==='ar'?'لا شيء':'None')));

    if(planDays) lines.push((currentLang==='ar'?'مدة الخطة: ':'Plan length: ') + planDays + (currentLang==='ar'?' يوم':' days'));
    if(sessionMinutes) lines.push((currentLang==='ar'?'المذاكرة اليومية: ':'Daily study: ') + (sessionMinutes/60).toFixed(1) + (currentLang==='ar'?' ساعة':' hr'));
    return lines;
}

/* ---------- قوالب الخطط المشتركة من الطلاب ---------- */
function openPublishTemplateForm(){
    const box = document.getElementById("publish-template-form");
    const opening = box.style.display === "none";
    box.style.display = opening ? "block" : "none";
    if(opening){
        let config = {};
        try{ config = JSON.parse(localStorage.getItem("khuta_config")) || {}; }catch(e){}
        const planDays = parseInt(localStorage.getItem("khuta_plan_days")) || 0;
        const sessionMinutes = parseInt(localStorage.getItem("khuta_session_minutes")) || 0;
        const summary = getConfigSummary(config, planDays, sessionMinutes);
        document.getElementById("tpl-preview").innerHTML = summary.map(l => `<div>• ${l}</div>`).join("");
    }
}

async function publishTemplate(){
    if(!sb) return;
    const title = document.getElementById("tpl-title").value.trim();
    const desc = document.getElementById("tpl-desc").value.trim();
    if(!title){ showToast(currentLang==='ar' ? "اكتب عنواناً للقالب" : "Give your template a title"); return; }
    const { data: userData } = await sb.auth.getUser();
    const uid = userData && userData.user && userData.user.id;
    if(!uid) return;
    let config = {};
    try{ config = JSON.parse(localStorage.getItem("khuta_config")) || {}; }catch(e){}
    const session = getSession();
    const authorName = (session && session.username) || (localStorage.getItem("khuta_name") || (currentLang==='ar'?"طالب":"Student"));
    const planDays = parseInt(localStorage.getItem("khuta_plan_days")) || null;
    const sessionMinutes = parseInt(localStorage.getItem("khuta_session_minutes")) || null;
    const sourcesSummary = getConfigSummary(config, planDays, sessionMinutes).join(" | ");
    const { error } = await sb.from("plan_templates").insert({
        author_id: uid, author_name: authorName, title, description: desc,
        config, plan_days: planDays, session_minutes: sessionMinutes, sources_summary: sourcesSummary,
    });
    if(error){ showToast(currentLang==='ar'?'تعذّر النشر':'Could not publish'); return; }
    document.getElementById("tpl-title").value = "";
    document.getElementById("tpl-desc").value = "";
    document.getElementById("publish-template-form").style.display = "none";
    showToast(currentLang==='ar' ? "🎉 تم نشر خطتك كقالب" : "🎉 Your plan is now published as a template");
    refreshTemplates();
}

async function refreshTemplates(){
    const box = document.getElementById("templates-list");
    if(!box || !sb) return;
    const { data: templates, error } = await sb.from("plan_templates").select("*").order("created_at", { ascending:false }).limit(30);
    if(error || !templates || !templates.length){
        box.innerHTML = `<div class="empty-note">${currentLang==='ar'?'لا توجد قوالب بعد — كن أول من يشارك!':'No templates yet — be the first to share!'}</div>`;
        return;
    }
    const now = Date.now();
    const { data: allRatings } = await sb.from("template_ratings").select("template_id, vote, comment, rater_id");
    const likesMap = {};
    templates.forEach(tpl => {
        const ratings = (allRatings || []).filter(r => r.template_id === tpl.id);
        likesMap[tpl.id] = ratings.filter(r => r.vote === "like").length;
    });

    // ترتيب القوالب: المثبَّت أولاً دائماً، ثم الأكثر إعجاباً، ثم الأحدث
    templates.sort((a,b) => {
        const aPinned = a.pinned_until && new Date(a.pinned_until).getTime() > now;
        const bPinned = b.pinned_until && new Date(b.pinned_until).getTime() > now;
        if(aPinned && !bPinned) return -1;
        if(!aPinned && bPinned) return 1;
        const likeDiff = likesMap[b.id] - likesMap[a.id];
        if(likeDiff !== 0) return likeDiff;
        return new Date(b.created_at) - new Date(a.created_at);
    });
    const topTemplates = templates.slice(0, 15); // نعرض أفضل 15 بعد الترتيب

    function getPopularityGlowClass(likes){
        if(likes >= 15) return "trending-glow-hot";
        if(likes >= 6) return "trending-glow-warm";
        return "";
    }

    box.innerHTML = topTemplates.map(tpl => {
        const ratings = (allRatings || []).filter(r => r.template_id === tpl.id);
        const likes = likesMap[tpl.id];
        const dislikes = ratings.filter(r => r.vote === "dislike").length;
        const comments = ratings.filter(r => r.comment).slice(0, 2);
        const isPinned = tpl.pinned_until && new Date(tpl.pinned_until).getTime() > now;
        const glowClass = isPinned ? "pinned-template-glow" : getPopularityGlowClass(likes);
        return `
        <div class="${glowClass}" style="padding:16px; border-radius:16px; background:var(--bg-alt); border:1px solid var(--border); margin-bottom:12px;">
            ${isPinned ? `<span style="font-size:10.5px; color:var(--gold); font-weight:700; display:block; margin-bottom:6px;"><i class="fa-solid fa-thumbtack"></i> ${currentLang==='ar'?'مثبَّت':'Pinned'}</span>` : (glowClass ? `<span style="font-size:10.5px; color:var(--gold); font-weight:700; display:block; margin-bottom:6px;"><i class="fa-solid fa-fire"></i> ${currentLang==='ar'?'الأكثر إعجاباً':'Highly rated'}</span>` : "")}
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                <div>
                    <b style="font-size:14.5px;">${escapeHtml(tpl.title)}</b>
                    <div style="font-size:11px; color:var(--text-3); margin-top:2px;">${escapeHtml(tpl.author_name)} · ${tpl.plan_days ? tpl.plan_days + (currentLang==='ar'?' يوم':' days') : ""}${tpl.session_minutes ? ' · ' + (tpl.session_minutes/60).toFixed(1) + (currentLang==='ar'?' ساعة/يوم':' hr/day') : ""}</div>
                </div>
                <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button type="button" class="btn btn-sm" onclick="useTemplate(${tpl.id})"><i class="fa-solid fa-download"></i> ${currentLang==='ar'?'استخدم':'Use'}</button>
                    ${!isPinned ? `<div class="icon-action" title="${currentLang==='ar'?`تثبيت (${PIN_TEMPLATE_COST} XP)`:`Pin (${PIN_TEMPLATE_COST} XP)`}" onclick="pinTemplateWithXP(${tpl.id})"><i class="fa-solid fa-thumbtack"></i></div>` : ""}
                    ${isAdmin ? `<button type="button" class="icon-action" title="${currentLang==='ar'?'حذف (صلاحية مشرف)':'Delete (admin)'}" onclick="deleteTemplate(${tpl.id})"><i class="fa-solid fa-trash"></i></button>` : ""}
                </div>
            </div>
            ${tpl.sources_summary ? `<div style="font-size:12px; color:var(--text-2); margin-top:8px; line-height:1.9; background:var(--surface); border-radius:10px; padding:8px 12px;">${escapeHtml(tpl.sources_summary).split(" | ").map(l => `• ${l}`).join("<br>")}</div>` : ""}
            ${tpl.description ? `<p style="font-size:12.5px; color:var(--text-2); margin-top:8px; line-height:1.7;">${escapeHtml(tpl.description)}</p>` : ""}
            <div style="display:flex; align-items:center; gap:14px; margin-top:10px;">
                <button type="button" class="btn-ghost" style="padding:4px 8px; font-size:12px;" onclick="rateTemplate(${tpl.id},'like')"><i class="fa-solid fa-thumbs-up" style="color:var(--teal);"></i> ${likes}</button>
                <button type="button" class="btn-ghost" style="padding:4px 8px; font-size:12px;" onclick="rateTemplate(${tpl.id},'dislike')"><i class="fa-solid fa-thumbs-down" style="color:var(--rose);"></i> ${dislikes}</button>
            </div>
            ${comments.length ? `<div style="margin-top:8px; border-top:1px dashed var(--border); padding-top:8px;">${comments.map(c=>`<div style="font-size:11.5px; color:var(--text-3); margin-top:4px;">💬 ${escapeHtml(c.comment)}</div>`).join("")}</div>` : ""}
        </div>`;
    }).join("");
}

async function deleteTemplate(id){
    if(!sb) return;
    if(!confirm(currentLang==='ar' ? "حذف هذا القالب نهائياً؟" : "Permanently delete this template?")) return;
    const { error } = await sb.from("plan_templates").delete().eq("id", id);
    if(error){ showToast(currentLang==='ar'?'تعذّر الحذف':'Could not delete'); return; }
    showToast(currentLang==='ar' ? "🗑️ تم الحذف" : "🗑️ Deleted");
    refreshTemplates();
}

async function pinTemplateWithXP(id){
    if(!sb) return;
    if(getXP() < PIN_TEMPLATE_COST){
        showToast(currentLang==='ar' ? `تحتاج ${PIN_TEMPLATE_COST} XP على الأقل — لديك ${getXP()} فقط` : `You need at least ${PIN_TEMPLATE_COST} XP — you have ${getXP()}`);
        return;
    }
    if(!confirm(currentLang==='ar' ? `تثبيت هذا القالب لأعلى القائمة لـ5 أيام مقابل ${PIN_TEMPLATE_COST} XP؟` : `Pin this template to the top for 5 days for ${PIN_TEMPLATE_COST} XP?`)) return;
    const { error } = await sb.rpc("pin_template", { template_id: id, days: 5 });
    if(error){ showToast(currentLang==='ar'?'تعذّر التثبيت':'Could not pin'); console.error(error); return; }
    setXP(getXP() - PIN_TEMPLATE_COST);
    showToast(currentLang==='ar' ? "📌 تم التثبيت لـ5 أيام" : "📌 Pinned for 5 days");
    refreshTemplates();
}

function useTemplate(templateId){
    if(!confirm(currentLang==='ar' ? "سيستبدل هذا خطتك الحالية بهذا القالب. متابعة؟" : "This will replace your current plan with this template. Continue?")) return;
    applyTemplate(templateId);
}

async function applyTemplate(templateId){
    const { data: tpl, error } = await sb.from("plan_templates").select("*").eq("id", templateId).maybeSingle();
    if(error || !tpl) return;
    localStorage.setItem("khuta_config", JSON.stringify(tpl.config));
    if(tpl.plan_days) localStorage.setItem("khuta_plan_days", tpl.plan_days);
    if(tpl.session_minutes) localStorage.setItem("khuta_session_minutes", tpl.session_minutes);
    localStorage.setItem("khuta_plan_start", new Date().toISOString());
    buildScheduleTable();
    renderProgress();
    switchTab("dashboard");
    showToast(currentLang==='ar' ? "✅ تم تطبيق القالب على جدولك" : "✅ Template applied to your schedule");
    debouncedSync();
}

async function rateTemplate(templateId, vote){
    if(!sb) return;
    const { data: userData } = await sb.auth.getUser();
    const uid = userData && userData.user && userData.user.id;
    if(!uid) return;
    let comment = null;
    if(vote === "dislike"){
        comment = prompt(currentLang==='ar' ? "(اختياري) ما الذي لم يعجبك في هذه الخطة؟" : "(optional) What didn't you like about this plan?");
    }
    await sb.from("template_ratings").upsert({ template_id: templateId, rater_id: uid, vote, comment: comment || null }, { onConflict: "template_id,rater_id" });
    refreshTemplates();
}


/* رابط JSON اختياري على GitHub لتعديل مواد/حصص/مسارات المعدل التراكمي
   بالكامل دون لمس الكود. الشكل المتوقع للملف:
   {
     "termsPerYear": {"1":2, "2":3, "3":3},
     "tracks": ["general","sharia","business","health","cs"],
     "trackLabels": {"general":{"ar":"المسار العام","en":"General Track"}, ...},
     "subjects": {
        "1": [{"ar":"لغة عربية","en":"Arabic","h":5}, ...],
        "general": [...], "sharia": [...], "business": [...], "health": [...], "cs": [...]
     }
   }
   ارفع هذا الملف على GitHub (repo عام)، انسخ رابط "Raw"، والصقه أدناه. */
const REMOTE_CURRICULUM_URL = "";

function getCurriculum(){ return window.__REMOTE_CURRICULUM__ || SAUDI_CURRICULUM_DEFAULT; }
function getCurriculumTracks(){ return (window.__REMOTE_CURRICULUM_META__ && window.__REMOTE_CURRICULUM_META__.tracks) || ["general","sharia","business","health","cs"]; }
function getTermsForYear(year){ return (window.__REMOTE_CURRICULUM_META__ && window.__REMOTE_CURRICULUM_META__.termsPerYear && window.__REMOTE_CURRICULUM_META__.termsPerYear[year]) || 3; }

async function tryLoadRemoteCurriculum(){
    if(!REMOTE_CURRICULUM_URL) return;
    try{
        const res = await fetch(REMOTE_CURRICULUM_URL, {cache:"no-store"});
        if(!res.ok) return;
        const json = await res.json();
        if(json && json.subjects){
            window.__REMOTE_CURRICULUM__ = json.subjects;
            window.__REMOTE_CURRICULUM_META__ = { termsPerYear: json.termsPerYear, tracks: json.tracks, trackLabels: json.trackLabels };
            populateGpaTrackOptions();
            populateGpaSemesterOptions();
        }
    }catch(e){ console.error("[خُطى] تعذّر جلب منهج المعدل من GitHub:", e); }
}

/* رابط JSON اختياري لإضافة/توسيع دليل التخصصات دون لمس الكود. الشكل:
   [{"id":"...", "icon":"fa-...", "track":"science",
     "ar":{"name":"...","desc":"...","career":"...","note":"...","branches":["...","..."],"universities":["..."]},
     "en":{...}}, ...]
   يمكنك إما استبدال القائمة كاملة أو (الأفضل) نسخ التنسيق وإضافة تخصصات جديدة.
   الملف على GitHub اسمه "تعديل التخصصات.json" — تعديله يظهر على الموقع مباشرة. */
const REMOTE_SPECIALTIES_URL = REMOTE_DATA_BASE + encodeURIComponent("تعديل التخصصات.json");

/* ============================================================
   36) بنك أسئلة الاختبار المحاكي
   ------------------------------------------------------------
   البنك الحقيقي في ملف "بنك الأسئلة.json" في مستودع my-website-data، ويحلّ
   محل الأمثلة أدناه تلقائياً. لإضافة أسئلة: افتح ذلك الملف على GitHub وأضف
   أسئلة بنفس الشكل، ثم احفظ — تظهر على الموقع مباشرة.
   الأسئلة أدناه نسخة احتياطية فقط، تُستعمل لو تعذّر جلب الملف أو كان معطوباً.
   ============================================================ */
const REMOTE_EXAM_QUESTIONS_URL = REMOTE_DATA_BASE + encodeURIComponent("بنك الأسئلة.json");

const EXAM_QUESTIONS_LOCAL = {
    quant: [
        { id:"q001", text:"إذا كان س + 5 = 12، فما قيمة س؟", choices:["5","6","7","8"], correct:2, source:"دورة إيهاب — الوحدة 3 (المعادلات)" },
        { id:"q002", text:"ما ناتج 15% من 200؟", choices:["20","25","30","35"], correct:2, source:"دورة المعاصر — التأسيس، النسبة المئوية" },
        { id:"q003", text:"متوالية حسابية حدها الأول 3 وأساسها 4، فما الحد السادس؟", choices:["19","21","23","27"], correct:2, source:"دورة أينشتاين — المتتاليات" },
        { id:"q004", text:"مستطيل طوله 12 وعرضه 5، فما محيطه؟", choices:["17","34","60","68"], correct:1, source:"دورة المنصف — الهندسة" },
        { id:"q005", text:"إذا كانت سرعة سيارة 80 كم/س، فكم تقطع خلال 45 دقيقة؟", choices:["40 كم","50 كم","60 كم","70 كم"], correct:2, source:"دورة إيهاب — الوحدة 5 (السرعة والزمن)" },
        { id:"q006", text:"ما هو ناتج (2)^5؟", choices:["16","32","64","10"], correct:1, source:"دورة المعاصر — الأسس" },
    ],
    verbal: [
        { id:"v001", text:"اختر الكلمة الأقرب معنى لكلمة (السَّخِيّ):", choices:["البخيل","الكريم","الشجاع","الحكيم"], correct:1, source:"دورة إيهاب — المفردات، الوحدة 2" },
        { id:"v002", text:"أكمل التناظر: (طبيب : مستشفى) كـ (معلم : ــــــ)", choices:["كتاب","مدرسة","طالب","سبورة"], correct:1, source:"دورة أينشتاين — التناظر اللفظي" },
        { id:"v003", text:"اختر الكلمة الشاذة التي لا تنتمي لبقية الكلمات:", choices:["تفاح","برتقال","خيار","عنب"], correct:2, source:"دورة المنصف — إكمال المتشابهات" },
        { id:"v004", text:"ما مضاد كلمة (اليقظة)؟", choices:["النشاط","الغفلة","الحذر","الفطنة"], correct:1, source:"دورة إيهاب — المفردات، الوحدة 4" },
        { id:"v005", text:"أكمل الجملة بالكلمة المناسبة: \"سعى الطالب إلى ــــــ أهدافه رغم الصعوبات.\"", choices:["إهمال","تحقيق","نسيان","تأجيل"], correct:1, source:"دورة المعاصر — استيعاب المقروء" },
        { id:"v006", text:"اختر الكلمة الأقرب لمعنى (المُثابرة):", choices:["الكسل","الإصرار","التردد","الاستسلام"], correct:1, source:"دورة أينشتاين — المفردات" },
        { id:"v007", text:"أكمل التناظر: (قلم : كتابة) كـ (مفتاح : ــــــ)", choices:["باب","فتح","قفل","بيت"], correct:1, source:"دورة إيهاب — التناظر اللفظي، الوحدة 6" },
    ],
};

// يدمج بنك الأسئلة المشترك (shared_exam_questions في Supabase — يُبنى
// تلقائياً من أسئلة صالحة استخرجها الذكاء الاصطناعي من ملفات طلاب سابقين،
// انظر gemini-proxy.js) فوق المصدر الأساسي (البعيد إن وُجد، وإلا المحلي)
function getExamQuestions(){
    const base = window.__REMOTE_EXAM_QUESTIONS__ || EXAM_QUESTIONS_LOCAL;
    const shared = window.__SHARED_EXAM_QUESTIONS__;
    if(!shared || (!shared.quant.length && !shared.verbal.length)) return base;
    return {
        quant: [...(base.quant || []), ...shared.quant],
        verbal: [...(base.verbal || []), ...shared.verbal],
    };
}

/* سؤال صالح = نص + خيارات (2 فأكثر، كلها نصوص) + correct يشير إلى خيار موجود.
   correct يبدأ من 0: أي أن 0 = الخيار الأول، و1 = الثاني… وهذا أكثر خطأ متوقّع
   ممن يضيف أسئلة، ولو مرّ لصُحّحت إجابة الطالب الصحيحة على أنها خاطئة. */
function questionRejectionReason(q, i, kind){
    const at = `${kind}[${i}]`;
    if(!q || typeof q !== "object") return `${at}: ليس كائناً`;
    if(!isText(q.text)) return `${at}: بلا نص سؤال ("text")`;
    if(!Array.isArray(q.choices) || q.choices.length < 2) return `${at}: يحتاج خيارين على الأقل`;
    if(!q.choices.every(isText)) return `${at}: أحد الخيارات فارغ أو ليس نصاً`;
    if(!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.choices.length)
        return `${at}: "correct" يجب أن يكون رقماً بين 0 و${q.choices.length - 1} (0 = الخيار الأول)`;
    return null;
}

function filterValidQuestions(arr, kind, problems){
    if(!Array.isArray(arr)) return [];
    return arr.filter((q, i) => {
        const why = questionRejectionReason(q, i, kind);
        if(why){ problems.push(why); return false; }
        return true;
    });
}

async function tryLoadRemoteExamQuestions(){
    if(!REMOTE_EXAM_QUESTIONS_URL) return;
    try{
        const res = await fetch(REMOTE_EXAM_QUESTIONS_URL, {cache:"no-store"});
        if(!res.ok) return;
        const json = await res.json();
        if(!json || typeof json !== "object" || (!json.quant && !json.verbal))
            return rejectRemote("بنك الأسئلة.json", 'الملف يجب أن يحوي "quant" و/أو "verbal"');

        const problems = [];
        const quant = filterValidQuestions(json.quant, "quant", problems);
        const verbal = filterValidQuestions(json.verbal, "verbal", problems);
        if(problems.length) console.warn(`[خُطى] استُبعد ${problems.length} سؤالاً من بنك GitHub:\n  - ` + problems.join("\n  - "));
        if(!quant.length && !verbal.length)
            return rejectRemote("بنك الأسئلة.json", "لم يجتز أي سؤال الفحص");

        window.__REMOTE_EXAM_QUESTIONS__ = { quant, verbal };
    }catch(e){
        console.warn("[خُطى] تعذّر قراءة \"بنك الأسئلة.json\" (خطأ صياغة JSON غالباً) — نستمر بالأسئلة المدمجة.", e);
    }
}

// يحمّل بنك الأسئلة المشترك من Supabase (قراءة عامة، لا حاجة لحساب) —
// يكبر تلقائياً بمرور الوقت كلما ولّد طلاب أكثر أسئلة صالحة من ملفاتهم
// الخاصة، فيصبح الاختبار القياسي (بلا رفع ملفات) أغنى تدريجياً بدل بقائه
// عالقاً على 13 سؤالاً توضيحياً فقط
async function loadSharedExamQuestions(){
    if(!sb) return;
    try{
        const { data, error } = await sb.from("shared_exam_questions")
            .select("id,section,text,choices,correct,explain,source_note")
            .limit(1000);
        if(error || !data) return;
        const quant = [], verbal = [];
        data.forEach(row => {
            const q = {
                id: "shared_" + row.id,
                text: row.text,
                choices: row.choices,
                correct: row.correct,
                explain: row.explain || "",
                source: row.source_note || (currentLang==='ar' ? "من مساهمات الطلاب 🤝" : "From student contributions 🤝"),
            };
            if(row.section === "quant") quant.push(q);
            else if(row.section === "verbal") verbal.push(q);
        });
        window.__SHARED_EXAM_QUESTIONS__ = { quant, verbal };
    }catch(e){ console.error("[خُطى] تعذّر تحميل بنك الأسئلة المشترك:", e); }
}

// تخصص صالح = له id واسم عربي واسم إنجليزي. الباقي اختياري ويُعرَض فارغاً بلا ضرر.
function specialtyIsValid(s){
    return s && typeof s === "object"
        && isText(s.id)
        && s.ar && isText(s.ar.name)
        && s.en && isText(s.en.name);
}

async function tryLoadRemoteSpecialties(){
    if(!REMOTE_SPECIALTIES_URL) return;
    try{
        const res = await fetch(REMOTE_SPECIALTIES_URL, {cache:"no-store"});
        if(!res.ok) return;
        const json = await res.json();
        if(!Array.isArray(json) || !json.length)
            return rejectRemote("تعديل التخصصات.json", "الملف ليس قائمة تخصصات غير فارغة");
        const good = json.filter(specialtyIsValid);
        const dropped = json.length - good.length;
        if(dropped) console.warn(`[خُطى] استُبعد ${dropped} تخصصاً بلا "id" أو بلا اسم عربي/إنجليزي.`);
        if(!good.length)
            return rejectRemote("تعديل التخصصات.json", "لم يجتز أي تخصص الفحص");
        window.__REMOTE_SPECIALTIES__ = good;
        renderSpecialties();
    }catch(e){
        console.warn("[خُطى] تعذّر قراءة \"تعديل التخصصات.json\" (خطأ صياغة JSON غالباً) — نستمر بالدليل المدمج.", e);
    }
}
// دمج بالـid تماماً كالجامعات — انظر mergeById في js/04-utils.js لسبب اختيار
// الدمج بدل الاستبدال. النتيجة: ملف GitHub لا يحتاج أن يكون قائمة كاملة.
function getSpecialties(){ return mergeById(SPECIALTIES, window.__REMOTE_SPECIALTIES__); }

/* ============================================================
   24) ترتيب بطاقات لوحة التحكم — تحريك بسيط بالأسهم بدل السحب والإفلات
   ============================================================ */
function initDashboardReorder(){
    const container = document.getElementById("dashboard-cards");
    if(!container) return;

    // حقن أزرار تحريك صغيرة في زاوية كل بطاقة
    container.querySelectorAll(":scope > .card").forEach(card => {
        if(card.querySelector(".reorder-controls")) return;
        const ctrl = document.createElement("div");
        ctrl.className = "reorder-controls";
        ctrl.innerHTML = `
            <button type="button" title="${currentLang==='ar'?'تحريك للأعلى':'Move up'}" onclick="moveDashCard('${card.id}',-1)"><i class="fa-solid fa-chevron-up"></i></button>
            <button type="button" title="${currentLang==='ar'?'تحريك للأسفل':'Move down'}" onclick="moveDashCard('${card.id}',1)"><i class="fa-solid fa-chevron-down"></i></button>
        `;
        card.style.position = "relative";
        card.appendChild(ctrl);
    });

    // استرجاع الترتيب المحفوظ
    let order = [];
    try{ order = JSON.parse(localStorage.getItem("khuta_dashboard_order")) || []; }catch(e){}
    if(order.length){
        order.forEach(id => {
            const el = document.getElementById(id);
            if(el) container.appendChild(el);
        });
    }
}

function moveDashCard(id, direction){
    const container = document.getElementById("dashboard-cards");
    const card = document.getElementById(id);
    if(!container || !card) return;
    const cards = Array.from(container.querySelectorAll(":scope > .card"));
    const idx = cards.indexOf(card);
    const targetIdx = idx + direction;
    if(targetIdx < 0 || targetIdx >= cards.length) return;
    if(direction < 0){
        container.insertBefore(card, cards[targetIdx]);
    } else {
        container.insertBefore(cards[targetIdx], card);
    }
    const newOrder = Array.from(container.querySelectorAll(":scope > .card")).map(c => c.id);
    localStorage.setItem("khuta_dashboard_order", JSON.stringify(newOrder));
}

/* ============================================================
   23) حاسبة المعدل التراكمي للثانوي (GPA)
   ============================================================ */
function setCalcMode(mode){
    document.getElementById("calc-mode-weighted").classList.toggle("selected", mode === "weighted");
    document.getElementById("calc-mode-gpa").classList.toggle("selected", mode === "gpa");
    document.getElementById("weighted-calc-view").style.display = mode === "weighted" ? "block" : "none";
    document.getElementById("gpa-calc-view").style.display = mode === "gpa" ? "block" : "none";
    if(mode === "gpa"){
        if(!document.getElementById("gpa-body").children.length){ addGpaRow(); addGpaRow(); addGpaRow(); }
        renderSavedYearAverages();
    }
}

/* بيانات تقديرية عن مواد نظام المسارات — مبنية على الهيكل العام المعلن من
   وزارة التعليم (سنة أولى مشتركة + مسارات تخصصية للسنتين الثانية والثالثة)،
   وليست نسخة حرفية من كشف درجات أي مدرسة. الحصص افتراضية وقابلة للتعديل. */
const SAUDI_CURRICULUM_DEFAULT = {
    "1": [ // السنة الأولى المشتركة — نفس المواد لكل الطلاب تقريباً
        { ar:"لغة عربية", en:"Arabic", h:5 }, { ar:"دراسات إسلامية", en:"Islamic Studies", h:4 },
        { ar:"رياضيات", en:"Math", h:5 }, { ar:"علوم عامة", en:"General Science", h:4 },
        { ar:"لغة إنجليزية", en:"English", h:4 }, { ar:"دراسات اجتماعية", en:"Social Studies", h:2 },
        { ar:"تفكير ناقد", en:"Critical Thinking", h:2 }, { ar:"مهارات رقمية", en:"Digital Skills", h:2 },
        { ar:"تربية بدنية", en:"PE", h:2 },
    ],
    general: [ { ar:"لغة عربية", en:"Arabic", h:4 }, { ar:"دراسات إسلامية", en:"Islamic Studies", h:3 },
        { ar:"رياضيات", en:"Math", h:4 }, { ar:"إنجليزي", en:"English", h:3 }, { ar:"مقرر مجال اختياري", en:"Elective", h:3 } ],
    sharia: [ { ar:"فقه وأصوله", en:"Fiqh", h:4 }, { ar:"تفسير", en:"Tafsir", h:3 },
        { ar:"حديث ومصطلح", en:"Hadith", h:3 }, { ar:"لغة عربية", en:"Arabic", h:4 }, { ar:"قانون", en:"Law", h:2 } ],
    business: [ { ar:"مبادئ إدارة الأعمال", en:"Business Fundamentals", h:4 }, { ar:"محاسبة", en:"Accounting", h:3 },
        { ar:"اقتصاد", en:"Economics", h:3 }, { ar:"قانون", en:"Law", h:2 }, { ar:"رياضيات مالية", en:"Financial Math", h:3 } ],
    health: [ { ar:"مقدمة في العلوم الصحية", en:"Intro to Health Sciences", h:4 }, { ar:"أحياء", en:"Biology", h:4 },
        { ar:"كيمياء", en:"Chemistry", h:4 }, { ar:"أنظمة جسم الإنسان", en:"Human Body Systems", h:3 }, { ar:"تصميم هندسي", en:"Engineering Design", h:2 } ],
    cs: [ { ar:"برمجة", en:"Programming", h:4 }, { ar:"رياضيات متقدمة", en:"Advanced Math", h:4 },
        { ar:"فيزياء", en:"Physics", h:3 }, { ar:"تصميم هندسي", en:"Engineering Design", h:2 }, { ar:"أمن سيبراني", en:"Cybersecurity", h:2 } ],
};

function populateGpaTrackOptions(){
    const sel = document.getElementById("gpa-track");
    if(!sel) return;
    const tracks = getCurriculumTracks();
    const labels = (window.__REMOTE_CURRICULUM_META__ && window.__REMOTE_CURRICULUM_META__.trackLabels) || {
        general:{ar:"المسار العام",en:"General Track"}, sharia:{ar:"المسار الشرعي",en:"Sharia Track"},
        business:{ar:"مسار إدارة الأعمال",en:"Business Track"}, health:{ar:"مسار الصحة والحياة",en:"Health & Life Track"},
        cs:{ar:"مسار الحاسب والهندسة",en:"Computer Science & Engineering Track"},
    };
    const prev = sel.value;
    sel.innerHTML = tracks.map(tr => `<option value="${tr}">${(labels[tr] && labels[tr][currentLang]) || tr}</option>`).join("");
    if(tracks.includes(prev)) sel.value = prev;
}

function populateGpaSemesterOptions(){
    const gradeSel = document.getElementById("gpa-grade");
    const semSel = document.getElementById("gpa-semester");
    if(!gradeSel || !semSel) return;
    const grade = gradeSel.value || "1";
    const count = getTermsForYear(grade);
    const prev = semSel.value;
    let opts = "";
    for(let i = 1; i <= count; i++){
        const labelKey = "gpa.sem" + i;
        opts += `<option value="${i}">${I18N[currentLang][labelKey] || ((currentLang==='ar'?"الفصل ":"Semester ") + i)}</option>`;
    }
    semSel.innerHTML = opts;
    if(Number(prev) <= count) semSel.value = prev;
}

function onGpaGradeChange(){
    const grade = document.getElementById("gpa-grade").value;
    document.getElementById("gpa-track-group").style.display = grade === "1" ? "none" : "block";
    populateGpaSemesterOptions();
}

function autofillGpaSubjects(){
    const grade = document.getElementById("gpa-grade").value;
    const track = document.getElementById("gpa-track").value;
    const curriculum = getCurriculum();
    const subjects = grade === "1" ? curriculum["1"] : curriculum[track];
    if(!subjects || !subjects.length){
        showToast(currentLang==='ar' ? "لا توجد بيانات لهذا الاختيار" : "No data for this selection");
        return;
    }
    document.getElementById("gpa-body").innerHTML = "";
    subjects.forEach(s => {
        addGpaRow();
        const rows = document.querySelectorAll("#gpa-body tr");
        const row = rows[rows.length - 1];
        const id = row.dataset.rowId;
        document.getElementById(`${id}-name`).value = currentLang === "ar" ? s.ar : s.en;
        document.getElementById(`${id}-hours`).value = s.h;
    });
    showToast(currentLang==='ar' ? "تمت التعبئة — أدخل درجاتك وعدّل الحصص إن اختلفت" : "Filled in — enter your scores and adjust hours if they differ");
}

let gpaRowId = 0;
function addGpaRow(){
    const id = "gpa_" + (gpaRowId++);
    const tr = document.createElement("tr");
    tr.dataset.rowId = id;
    tr.innerHTML = `
        <td><input type="text" class="task-input" placeholder="${currentLang==='ar'?'مثال: رياضيات':'e.g. Math'}" id="${id}-name"></td>
        <td><input type="number" class="task-input" min="0" max="100" placeholder="95" id="${id}-score"></td>
        <td><input type="number" class="task-input" min="1" max="10" value="3" id="${id}-hours"></td>
        <td><div class="row-actions"><div class="icon-action" onclick="this.closest('tr').remove()"><i class="fa-solid fa-trash"></i></div></div></td>
    `;
    document.getElementById("gpa-body").appendChild(tr);
}

function calcGpa(){
    const rows = document.querySelectorAll("#gpa-body tr");
    let totalWeighted = 0, totalHours = 0;
    rows.forEach(row => {
        const id = row.dataset.rowId;
        const score = parseFloat(document.getElementById(`${id}-score`).value);
        const hours = parseFloat(document.getElementById(`${id}-hours`).value) || 0;
        if(!isNaN(score) && hours > 0){ totalWeighted += score * hours; totalHours += hours; }
    });
    if(totalHours === 0){ showToast(currentLang==='ar' ? "أضف درجة وساعات معتمدة لمادة واحدة على الأقل" : "Add a score and credit hours for at least one subject"); return; }
    const avg = totalWeighted / totalHours;
    document.getElementById("gpa-result-box").style.display = "block";
    document.getElementById("gpa-result").textContent = avg.toFixed(2) + "%";

    const bands = currentLang === "ar"
        ? [[95,"ممتاز مرتفع"],[90,"ممتاز"],[85,"جيد جداً مرتفع"],[80,"جيد جداً"],[75,"جيد مرتفع"],[65,"جيد"],[50,"مقبول"],[0,"ضعيف"]]
        : [[95,"Excellent+"],[90,"Excellent"],[85,"Very Good+"],[80,"Very Good"],[75,"Good+"],[65,"Good"],[50,"Pass"],[0,"Weak"]];
    const grade = bands.find(b => avg >= b[0])[1];
    document.getElementById("gpa-grade-result").textContent = (currentLang==='ar' ? "التقدير: " : "Grade: ") + grade;
}

function quickSaveYearAverages(){
    const y1 = parseFloat(document.getElementById("quick-y1").value);
    const y2 = parseFloat(document.getElementById("quick-y2").value);
    const y3 = parseFloat(document.getElementById("quick-y3").value);
    const entries = { "1": y1, "2": y2, "3": y3 };
    const valid = Object.entries(entries).filter(([, v]) => !isNaN(v) && v >= 0 && v <= 100);
    if(!valid.length){
        showToast(currentLang==='ar' ? "أدخل نسبة واحدة على الأقل بين 0 و100" : "Enter at least one percentage between 0 and 100");
        return;
    }
    const saved = getSavedYearAverages();
    valid.forEach(([year, v]) => { saved[year] = v; });
    localStorage.setItem("khuta_year_averages", JSON.stringify(saved));
    renderSavedYearAverages();
    debouncedSync();
    showToast(currentLang==='ar' ? `✅ تم حفظ ${valid.length} من نسب السنوات` : `✅ Saved ${valid.length} year percentage(s)`);
}


/* الافتراضي 20% / 40% / 40% حسب نظام المسارات الحالي، وقابل للتحديث عبر
   REMOTE_CURRICULUM_URL (أضف "yearWeights": {"1":20,"2":40,"3":40} لملف
   JSON على GitHub) لأن هذه النسب تتغير من عام لآخر كما تعرف. */
function getYearWeights(){
    return (window.__REMOTE_CURRICULUM_META__ && window.__REMOTE_CURRICULUM_META__.yearWeights) || { "1":20, "2":40, "3":40 };
}

function getSavedYearAverages(){
    try{ return JSON.parse(localStorage.getItem("khuta_year_averages")) || {}; }catch(e){ return {}; }
}

function saveYearAverage(){
    const grade = document.getElementById("gpa-grade").value;
    const resultText = document.getElementById("gpa-result").textContent;
    const avg = parseFloat(resultText);
    if(isNaN(avg)){ showToast(currentLang==='ar' ? "احسب المعدل أولاً" : "Calculate the average first"); return; }
    const saved = getSavedYearAverages();
    saved[grade] = avg;
    localStorage.setItem("khuta_year_averages", JSON.stringify(saved));
    showToast(currentLang==='ar' ? `✅ تم حفظ معدل ${gradeLabelAr(grade)}` : `✅ Saved Year ${grade} average`);
    renderSavedYearAverages();
    debouncedSync();
}

function gradeLabelAr(grade){
    return grade === "1" ? "أول ثانوي" : grade === "2" ? "ثاني ثانوي" : "ثالث ثانوي";
}

function renderSavedYearAverages(){
    const saved = getSavedYearAverages();
    const y1 = document.getElementById("gpa-y1-display");
    if(!y1) return;
    document.getElementById("gpa-y1-display").textContent = saved["1"] != null ? saved["1"].toFixed(2) + "%" : "—";
    document.getElementById("gpa-y2-display").textContent = saved["2"] != null ? saved["2"].toFixed(2) + "%" : "—";
    document.getElementById("gpa-y3-display").textContent = saved["3"] != null ? saved["3"].toFixed(2) + "%" : "—";
}

function calcFinalHighSchoolPct(){
    const saved = getSavedYearAverages();
    const weights = getYearWeights();
    const missing = ["1","2","3"].filter(y => saved[y] == null);
    if(missing.length){
        showToast(currentLang==='ar'
            ? `أكمل حفظ معدل ${missing.map(gradeLabelAr).join(" و")} أولاً`
            : `Save the average for ${missing.join(", ")} first`);
        return;
    }
    const final = (saved["1"] * weights["1"] + saved["2"] * weights["2"] + saved["3"] * weights["3"]) / 100;
    document.getElementById("gpa-final-box").style.display = "block";
    document.getElementById("gpa-final-result").textContent = final.toFixed(2) + "%";
}

/* ============================================================
   الذكاء الاصطناعي الحقيقي لمساعد الأسئلة الشائعة (اختياري)
   ------------------------------------------------------------
   كيف تحصل على مفتاح مجاني من Gemini (Google):
   1) اذهب إلى https://aistudio.google.com/apikey
   2) سجّل دخولك بحساب Google، اضغط "Create API key"
   3) انسخ المفتاح كاملاً (زر "Copy key") والصقه هنا بين علامتي التنصيص
   الباقة المجانية كافية لتطبيق طلابي عادي.
   ✅ تصحيح مني: قلت لك سابقاً إن المفتاح الذي يبدأ بـ"AQ." شكله خاطئ —
   هذا كان خطأً مني. صور شاشتك من صفحة "API key details" في Google AI
   Studio تؤكد أن "AQ.Ab8..." هو فعلاً الشكل الحالي الصحيح لمفاتيح Gemini
   (شكل المفاتيح تغيّر). اعتذر عن الالتباس — أي مفتاح نسخته من هناك بزر
   "Copy key" صحيح ويعمل.
   ⚠️ بما أنك عرضت عدة مفاتيح في المحادثة، لم أضع أياً منها هنا حفاظاً على
   نظافة الكود المُسلَّم — الصق أنت مفتاحاً واحداً تختاره (يفضَّل مشروع
   واحد واضح الاسم، واحذف الباقي من aistudio.google.com/apikey لتنظيف
   حسابك، ليس ضرورياً لكنه أنظف).
   تأكد أيضاً أن "Generative Language API" مُفعّلة على نفس المشروع الذي
   أخذت منه المفتاح، من Google Cloud Console → APIs & Services → Library.
   ⚠️ تحذير أمني صادق (لا يزال قائماً): أي مفتاح توضعه هنا يظهر لأي شخص
   يفتح "عرض مصدر الصفحة" في متصفحه، لأن هذا كود يعمل في متصفح الطالب
   مباشرة (client-side). بما أن موقعك يُرفع عبر Netlify Drop (رفع يدوي
   وليس من GitHub)، فلا يوجد خطر إضافي من مستودع عام — الخطر الوحيد هو
   نفسه: أي زائر لموقعك يقدر يرى المفتاح عبر أدوات المطوّر. مقبول لتطبيق
   طلابي بسيط على الخطة المجانية.
   ============================================================ */
/* ⚠️ لم يعد مفتاح Gemini يُكتب هنا إطلاقاً — كان ظاهراً لأي شخص يفتح "عرض
   مصدر الصفحة"، وهذه كانت أكبر ثغرة أمنية في الموقع. المفتاح الآن يعيش فقط
   كمتغيّر بيئة سرّي على خوادم Netlify (GEMINI_API_KEY)، ولا يصل للمتصفح
   إطلاقاً — الطلبات تمر عبر netlify/functions/gemini-proxy.js بدلاً من
   الاتصال المباشر بـGoogle. راجع تعليمات الإعداد المرفقة لضبط المتغيّر.

   ⚠️ إصلاح أمني ثانٍ (بعد مراجعة تقنية خارجية): الموديل وكل تعليمات النظام
   (الهوية، الأدوار، قواعد JSON...) كانت مكتوبة هنا في app.js وتُرسَل مع كل
   طلب — يعني أي شخص يستدعي gemini-proxy.js مباشرة (بدون فتح الموقع) يقدر
   يرسل تعليمات نظام خاصة به بالكامل متجاوزاً كل قيود خُطى. الآن جميع هذه
   الثوابت (الهوية، الأدوار الثلاثة، قواعد كل نمط) موجودة فقط داخل
   netlify/functions/gemini-proxy.js نفسها — المتصفح لا يرسل ولا يقدر
   إرسال أي تعليمات نظام إطلاقاً، فقط "mode" من قائمة محدودة ثابتة. */

// سجلّ القوائم التي يقدر مساعد خُطى ينقل الطالب إليها فعلياً داخل الموقع
// (تفعيل بصري حقيقي: تبديل تبويب أو فتح نافذة + تظليل تعريفي عند الحاجة)
// — إعداد واجهة بحتة، لا علاقة له بتعليمات النظام (تلك أصبحت في الخادم)
const NAV_TARGETS = {
    dashboard:            { type:"tab", tab:"dashboard", titleAr:"لوحتك الرئيسية", textAr:"هنا جدولك اليومي ونشاطك ومسار تقدّمك." },
    session:              { type:"tab", tab:"dashboard", elementId:"btn-plan-session", titleAr:"ابدأ جلستك", textAr:"من هنا تبدأ جلسة تركيز — يقسم المؤقت وقتك تلقائياً بين الكمي واللفظي." },
    customize_dashboard:  { type:"tab", tab:"dashboard", elementId:"btn-customize-dashboard", titleAr:"خصّص لوحتك", textAr:"أضف أو أخفِ البطاقات التي تناسبك من هنا." },
    calculator:           { type:"tab", tab:"calculator", titleAr:"حاسبة الموزونة", textAr:"احسب نسبتك الموزونة لأكثر من 30 جامعة سعودية." },
    links:                { type:"tab", tab:"links", titleAr:"الروابط المباشرة", textAr:"كل روابط مصادرك (إيهاب، المنصف، المعاصر، المفكر) في مكان واحد." },
    specialties:          { type:"tab", tab:"specialties", titleAr:"دليل التخصصات", textAr:"تصفّح أكثر من 20 تخصصاً جامعياً بتفاصيلها ومسارها الوظيفي." },
    community:            { type:"tab", tab:"community", titleAr:"المجتمع", textAr:"شاهد من يذاكر معك الآن، أو شارك بلوحة الصدارة الأسبوعية." },
    profile:              { type:"tab", tab:"profile", titleAr:"ملفك الشخصي", textAr:"إدارة حسابك، درع حماية السلسلة، وأوسمتك." },
    plan_setup:           { type:"action", action:"openSetupOverlay" },
    routine:              { type:"action", action:"openSetupOverlayRoutine" },
    board:                { type:"action", action:"openKhutaBoardFull" },
};
function openSetupOverlayRoutine(){ openSetupOverlay("routine"); }
function openKhutaBoardFull(){ openKhutaBoard("ai", true); }

