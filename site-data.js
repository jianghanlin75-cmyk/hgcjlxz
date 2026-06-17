window.HBEU_SITE_DATA = {
  university: {
    name: "湖北工程学院",
    englishName: "Hubei Engineering University",
    city: "湖北孝感",
    audience: "2026 新生校园导览",
    heroImage: "",
    heroSlot: "hero-campus",
    campusMap: {
      apiKey: "",
      securityJsCode: "",
      version: "2.0",
      center: [113.920343, 30.936542],
      zoom: 16,
      minZoom: 14,
      maxZoom: 19,
      viewMode: "2D",
      mapStyle: "amap://styles/normal",
      note: "底图改为高德 JS API 2.0 原生地图；中心点使用高德坐标系，后续点位以你在地图上的人工标注为准。"
    },
    note: "当前为可编辑框架版：元素、卡片、点位和多图素材均可继续在页面内增减。"
  },
  routes: [
    {
      id: "first-day",
      label: "报到首日",
      icon: "sparkles",
      title: "校门 -> 寝室 -> 快递 -> 食堂周边",
      steps: ["从主入口进入", "到寝室区完成入住", "熟悉快递取件点", "确认最近生活补给点"]
    },
    {
      id: "study-day",
      label: "军训",
      icon: "book-open",
      title: "寝室 -> 食堂 -> 早训晚训 -> 寝室",
      steps: ["从寝室区出发", "先到食堂补充能量", "参加早训晚训", "回寝室整理休息"]
    },
    {
      id: "weekend",
      label: "周末探索",
      icon: "utensils",
      title: "校区漫游 -> 校内外美食 -> 超市补给",
      steps: ["补拍校园打卡点", "探索校内外美食网点", "回校采购日用品", "好好休息"]
    }
  ],
  sections: [
    {
      id: "teaching",
      label: "教学楼和教室",
      short: "教学",
      icon: "building-2",
      accent: "#0f9f8f",
      tone: "从公共课到专业课，把新生最常找的教学空间分成两类，后续可以继续补具体楼栋和教室。",
      filters: ["教学楼及其部分教室", "学院所属教学楼及其部分教室"],
      elements: [
        { id: "teaching-general", label: "教学楼及其部分教室" },
        { id: "teaching-college", label: "学院所属教学楼及其部分教室" }
      ],
      items: [
        {
          id: "teaching-general-card",
          title: "教学楼及其部分教室",
          subtitle: "公共课、自习、阶梯教室等高频教学空间",
          image: "",
          slot: "teaching-general-card",
          elementId: "teaching-general",
          tags: ["教学楼"],
          facts: ["补楼栋外观、入口、楼层导视和常用教室照片", "记录早八换楼、课间拥堵和晚自习开放情况", "适合标注从寝室、食堂、图书馆出发的步行时间"]
        },
        {
          id: "teaching-college-card",
          title: "学院所属教学楼及其部分教室",
          subtitle: "专业课、实验实训、学院办公与专业学习空间",
          image: "",
          slot: "teaching-college-card",
          elementId: "teaching-college",
          tags: ["学院教学楼"],
          facts: ["按学院补充所属楼栋、实验室和专业教室", "拍摄门牌、楼层分布和专业课常用入口", "可继续拆成不同学院的二级卡片"]
        }
      ]
    },
    {
      id: "express",
      label: "学校快递网点",
      short: "快递",
      icon: "package",
      accent: "#e2553f",
      tone: "快递点按实际站点组织，方便新生按所在区域快速找到取件位置。",
      filters: ["同大快递站点", "西区快递站点", "博雅苑快递站点", "东区站点"],
      elements: [
        { id: "express-tongda", label: "同大快递站点" },
        { id: "express-west", label: "西区快递站点" },
        { id: "express-boya", label: "博雅苑快递站点" },
        { id: "express-east", label: "东区站点" }
      ],
      items: [
        {
          id: "express-tongda-card",
          title: "同大快递站点",
          subtitle: "同大校区附近取件、寄件和退换货信息",
          image: "",
          slot: "express-tongda-card",
          elementId: "express-tongda",
          tags: ["同大快递"],
          facts: ["补站点门头、入口、货架和排队区图片", "记录营业时间、取件码规则和寄件流程", "适合标注从同大寝室区出发的路线"]
        },
        {
          id: "express-west-card",
          title: "西区快递站点",
          subtitle: "西区学生常用的快递取件点",
          image: "",
          slot: "express-west-card",
          elementId: "express-west",
          tags: ["西区快递"],
          facts: ["补准确定位、入口照片和取件窗口", "记录雨天排队、夜间照明和大件取件方式", "适合和西区寝室、超市卡片联动"]
        },
        {
          id: "express-boya-card",
          title: "博雅苑快递站点",
          subtitle: "博雅苑周边取件、临时大件和高峰提醒",
          image: "",
          slot: "express-boya-card",
          elementId: "express-boya",
          tags: ["博雅苑快递"],
          facts: ["补博雅苑站点外观和周边参照物", "记录大件包裹、退换货和高峰时段", "适合给新生加取件避坑提示"]
        },
        {
          id: "express-east-card",
          title: "东区站点",
          subtitle: "东区学生取件、寄件与临时包裹点",
          image: "",
          slot: "express-east-card",
          elementId: "express-east",
          tags: ["东区快递"],
          facts: ["补东区站点定位、门头和货架照片", "记录常见快递品牌和取件流程", "适合标注从东区宿舍步行到达路线"]
        }
      ]
    },
    {
      id: "sports",
      label: "体育运动场所",
      short: "运动",
      icon: "dumbbell",
      accent: "#2f7fd4",
      tone: "运动空间按体育馆、操场、球场和商业性质场所分开，避免卡片和元素混在一起。",
      filters: ["体育馆", "操场", "球场", "商业性质场所"],
      elements: [
        { id: "sports-gym", label: "体育馆" },
        { id: "sports-track", label: "操场" },
        { id: "sports-court", label: "球场" },
        { id: "sports-commercial", label: "商业性质场所" }
      ],
      items: [
        {
          id: "sports-gym-card",
          title: "体育馆",
          subtitle: "室内课程、校级赛事和雨天运动空间",
          image: "",
          slot: "sports-gym-card",
          elementId: "sports-gym",
          tags: ["体育馆"],
          facts: ["补入口、场馆内部、开放时间和课程占用情况", "记录是否预约、可进入区域和赛事信息", "适合展示社团活动和大型活动现场"]
        },
        {
          id: "sports-track-card",
          title: "操场",
          subtitle: "跑步、军训、运动会和夜跑集合地",
          image: "",
          slot: "sports-track-card",
          elementId: "sports-track",
          tags: ["操场"],
          facts: ["补全景、跑道入口、看台和夜间灯光", "记录开放时间、人流高峰和雨后可用情况", "适合加早晚跑路线与集合点"]
        },
        {
          id: "sports-court-card",
          title: "球场",
          subtitle: "篮球、排球、羽毛球等球类场地集合",
          image: "",
          slot: "sports-court-card",
          elementId: "sports-court",
          tags: ["球场"],
          facts: ["按球类补具体场地编号和灯光条件", "记录预约、器材租借和热门时段", "适合拆出篮球场、排球场等子卡片"]
        },
        {
          id: "sports-commercial-card",
          title: "商业性质场所",
          subtitle: "健身、台球、运动培训等付费运动空间",
          image: "",
          slot: "sports-commercial-card",
          elementId: "sports-commercial",
          tags: ["商业运动"],
          facts: ["补店名、价格、距离和营业时间", "记录是否适合新生长期使用", "这类卡片保留主观评价和避坑信息"]
        }
      ]
    },
    {
      id: "retail",
      label: "校内零售超市",
      short: "超市",
      icon: "shopping-bag",
      accent: "#c48700",
      tone: "超市按区域拆分，后续每个区域都能继续追加具体门店卡片。",
      filters: ["同大校区", "西区", "东区", "三里", "校外水果店及超市"],
      elements: [
        { id: "retail-tongda", label: "同大校区" },
        { id: "retail-west", label: "西区" },
        { id: "retail-east", label: "东区" },
        { id: "retail-sanli", label: "三里" },
        { id: "retail-offcampus", label: "校外水果店及超市" }
      ],
      items: [
        {
          id: "retail-tongda-card",
          title: "同大校区超市",
          subtitle: "同大校区日用品、零食和应急补给",
          image: "",
          slot: "retail-tongda-card",
          elementId: "retail-tongda",
          tags: ["同大超市"],
          facts: ["补门店外观、货架、热卖品类和付款方式", "记录营业时间和离寝室最近入口", "适合加新生必买清单"]
        },
        {
          id: "retail-west-card",
          title: "西区超市",
          subtitle: "西区寝室与教学区之间的常用补给点",
          image: "",
          slot: "retail-west-card",
          elementId: "retail-west",
          tags: ["西区超市"],
          facts: ["补门店位置、常用品类和排队高峰", "记录文具、打印、生活用品是否齐全", "适合和西区快递点联动"]
        },
        {
          id: "retail-east-card",
          title: "东区超市",
          subtitle: "东区学生常用购物与生活补给点",
          image: "",
          slot: "retail-east-card",
          elementId: "retail-east",
          tags: ["东区超市"],
          facts: ["补东区具体店面和入口照片", "记录日用品、饮料、零食和价格区间", "适合标注晚间营业情况"]
        },
        {
          id: "retail-sanli-card",
          title: "三里超市",
          subtitle: "三里片区采购、生活用品和零食补给",
          image: "",
          slot: "retail-sanli-card",
          elementId: "retail-sanli",
          tags: ["三里超市"],
          facts: ["补三里片区门店和街区参照物", "记录价格、品类和步行时间", "适合放周末采购建议"]
        },
        {
          id: "retail-offcampus-card",
          title: "校外水果店及超市",
          subtitle: "校门外水果、零食和大件采购选择",
          image: "",
          slot: "retail-offcampus-card",
          elementId: "retail-offcampus",
          tags: ["校外超市"],
          facts: ["补水果店、便利店和大型超市门头", "记录价格、口碑和适合购买的品类", "可以保留主观推荐和避坑提示"]
        }
      ]
    },
    {
      id: "library",
      label: "图书馆内部介绍",
      short: "图书馆",
      icon: "library-big",
      accent: "#7863d9",
      tone: "图书馆按自习、借阅和室外沿湖区域三条使用路径组织。",
      filters: ["自习区域", "书籍借阅", "室外沿湖区域"],
      elements: [
        { id: "library-study", label: "自习区域" },
        { id: "library-borrow", label: "书籍借阅" },
        { id: "library-lakeside", label: "室外沿湖区域" }
      ],
      items: [
        {
          id: "library-study-card",
          title: "自习区域",
          subtitle: "安静阅览、期末复习和长期备考座位",
          image: "",
          slot: "library-study-card",
          elementId: "library-study",
          tags: ["自习"],
          facts: ["补座位密度、插座、窗边位置和拥挤时段", "记录预约、占座规则和安静程度", "适合给新生做自习座位选择指南"]
        },
        {
          id: "library-borrow-card",
          title: "书籍借阅",
          subtitle: "馆藏检索、借还服务台和图书区域",
          image: "",
          slot: "library-borrow-card",
          elementId: "library-borrow",
          tags: ["借阅"],
          facts: ["补服务台、自助借还机和检索终端照片", "记录借阅规则、续借方式和失物招领", "适合链接图书馆新生教程"]
        },
        {
          id: "library-lakeside-card",
          title: "室外沿湖区域",
          subtitle: "图书馆周边散步、拍照和短暂休息区域",
          image: "",
          slot: "library-lakeside-card",
          elementId: "library-lakeside",
          tags: ["沿湖区域"],
          facts: ["补沿湖步道、座椅、树荫和最佳拍摄角度", "记录适合早晚停留的时间段", "适合放校园氛围和生活感照片"]
        }
      ]
    },
    {
      id: "dorms",
      label: "寝室板块",
      short: "寝室",
      icon: "bed-double",
      accent: "#dd5b88",
      tone: "寝室板块取消男女区分，聚焦真实生活设施。",
      filters: ["寝室", "洗衣房", "热水机", "吹头"],
      elements: [
        { id: "dorm-room", label: "寝室" },
        { id: "dorm-laundry", label: "洗衣房" },
        { id: "dorm-hot-water", label: "热水机" },
        { id: "dorm-hair-dryer", label: "吹头" }
      ],
      items: [
        {
          id: "dorm-room-card",
          title: "寝室",
          subtitle: "楼栋、房间、公共空间和入住注意事项",
          image: "",
          slot: "dorm-room-card",
          elementId: "dorm-room",
          tags: ["寝室"],
          facts: ["补寝室楼外观、入口、楼道和房间照片", "记录门禁、报修、晾晒和公共空间", "适合加新生入住 checklist"]
        },
        {
          id: "dorm-laundry-card",
          title: "洗衣房",
          subtitle: "洗衣机位置、数量、支付方式和排队高峰",
          image: "",
          slot: "dorm-laundry-card",
          elementId: "dorm-laundry",
          tags: ["洗衣房"],
          facts: ["补每个楼栋或片区洗衣房位置", "记录机器数量、付款二维码和开放时间", "适合加故障报修和避峰建议"]
        },
        {
          id: "dorm-hot-water-card",
          title: "热水机",
          subtitle: "热水点位置、使用方式和故障反馈",
          image: "",
          slot: "dorm-hot-water-card",
          elementId: "dorm-hot-water",
          tags: ["热水机"],
          facts: ["补热水机分布、设备照片和使用步骤", "记录高峰时段、支付方式和备用点", "适合加维修反馈入口"]
        },
        {
          id: "dorm-hair-dryer-card",
          title: "吹头",
          subtitle: "吹头设备位置、插座数量和安全提醒",
          image: "",
          slot: "dorm-hair-dryer-card",
          elementId: "dorm-hair-dryer",
          tags: ["吹头"],
          facts: ["补设备位置、插座数量和排队情况", "记录使用限制、安全提醒和故障反馈", "适合加不同楼栋的可用点位"]
        }
      ]
    },
    {
      id: "campus",
      label: "学校校区介绍",
      short: "校区",
      icon: "map",
      accent: "#3b8b4f",
      tone: "校区按同大、新院、本院拆分，避免泛泛地讲校园。",
      filters: ["同大校区", "新院", "本院"],
      elements: [
        { id: "campus-tongda", label: "同大校区" },
        { id: "campus-new", label: "新院" },
        { id: "campus-main", label: "本院" }
      ],
      items: [
        {
          id: "campus-tongda-card",
          title: "同大校区",
          subtitle: "同大校区入口、教学生活区域和常用点位",
          image: "",
          slot: "campus-tongda-card",
          elementId: "campus-tongda",
          tags: ["同大校区"],
          facts: ["补校区入口、主路、教学楼和生活服务照片", "记录从主校区到同大的交通方式", "适合标注同大内的快递、超市、寝室点位"]
        },
        {
          id: "campus-new-card",
          title: "新院",
          subtitle: "新院片区的学习、生活和服务空间",
          image: "",
          slot: "campus-new-card",
          elementId: "campus-new",
          tags: ["新院"],
          facts: ["补新院入口、核心楼栋和周边服务", "记录新生办事、上课和生活常走路线", "适合继续追加具体建筑卡片"]
        },
        {
          id: "campus-main-card",
          title: "本院",
          subtitle: "本院主区域、校门、主干道和标志性点位",
          image: "",
          slot: "campus-main-card",
          elementId: "campus-main",
          tags: ["本院"],
          facts: ["补校门、主干道、核心建筑和景观照片", "记录报到、上课、办事和日常动线", "适合作为新生认路的总览入口"]
        }
      ]
    },
    {
      id: "traffic",
      label: "校内外交通和出入口",
      short: "交通",
      icon: "bus",
      accent: "#1f8aa5",
      tone: "交通只保留三类新生高频移动方式：微循环巴士、网约车、电动车。",
      filters: ["微循环巴士", "网约车", "电动车"],
      elements: [
        { id: "traffic-microbus", label: "微循环巴士" },
        { id: "traffic-ride", label: "网约车" },
        { id: "traffic-ebike", label: "电动车" }
      ],
      items: [
        {
          id: "traffic-microbus-card",
          title: "微循环巴士",
          subtitle: "校内短距接驳、站点、运行时段和乘坐提醒",
          image: "",
          slot: "traffic-microbus-card",
          elementId: "traffic-microbus",
          tags: ["微循环巴士"],
          facts: ["补站牌、车辆、候车点和运行线路", "记录发车间隔、热门时段和是否拥挤", "适合标注从寝室到教学区的接驳方式"]
        },
        {
          id: "traffic-ride-card",
          title: "网约车",
          subtitle: "上下车点、推荐定位和雨天返校提醒",
          image: "",
          slot: "traffic-ride-card",
          elementId: "traffic-ride",
          tags: ["网约车"],
          facts: ["补推荐定位名称、可等待区域和禁停区", "记录报到季、雨天、夜间返校的使用建议", "适合加安全提示和拥堵高峰"]
        },
        {
          id: "traffic-ebike-card",
          title: "电动车",
          subtitle: "骑行路线、停放点、充电区域和安全规范",
          image: "",
          slot: "traffic-ebike-card",
          elementId: "traffic-ebike",
          tags: ["电动车"],
          facts: ["补停车区、充电点和路口照片", "记录推荐骑行路线、禁行区域和安全提醒", "适合继续追加各片区停车点卡片"]
        }
      ]
    },
    {
      id: "food",
      label: "学校内外美食网点",
      short: "美食",
      icon: "utensils",
      accent: "#df6b25",
      tone: "食堂解决日常，校外口碑店负责惊喜；这部分可以保留足够主观的推荐气质。",
      filters: ["食堂", "校外口碑店（纯主观）"],
      elements: [
        { id: "food-canteen", label: "食堂" },
        { id: "food-offcampus", label: "校外口碑店（纯主观）" }
      ],
      items: [
        {
          id: "food-canteen-card",
          title: "食堂",
          subtitle: "早餐、正餐、夜间窗口和高性价比选择",
          image: "",
          slot: "food-canteen-card",
          elementId: "food-canteen",
          tags: ["食堂"],
          facts: ["补每个食堂入口、窗口、菜单和排队情况", "记录口味、价格、拥挤时段和推荐窗口", "适合做学生主观评分榜"]
        },
        {
          id: "food-offcampus-card",
          title: "校外口碑店（纯主观）",
          subtitle: "校外早餐、正餐、夜宵、饮品和甜品主观推荐",
          image: "",
          slot: "food-offcampus-card",
          elementId: "food-offcampus",
          tags: ["校外口碑店"],
          facts: ["补店名、门头、菜单、价格和步行时间", "允许保留强主观评价、推荐理由和避坑信息", "适合按早餐、聚餐、夜宵、饮品继续追加子卡片"]
        }
      ]
    }
  ]
};
