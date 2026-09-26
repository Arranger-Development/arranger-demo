// Notion 深秋 #Cm BPM 100, transcribed 2026-09-26.
// Pitched events: [zero-based sixteenth, pitch, optional duration in steps (default 1)].
// Source pitches are literal: chromatic C/G/A# and octave-2 harmony are retained.
export const DEEP_AUTUMN_TEMPLATES = {
  drums: [
    {
      id: "deep-autumn-drums-crossed-paths",
      name: "阴差阳错",
      kind: "main",
      barCount: 2,
      bars: [
        {"kick": [2, 3, 6, 10], "snare": [12], "hihat": [0, 5, 6, 7, 8, 11, 12, 13, 14]},
        {"kick": [2, 4, 7, 8, 10], "snare": [12], "hihat": [1, 2, 4, 5, 7, 8, 9, 10, 12, 13, 14, 15]},
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee804f96c7d0d9b6ac927c", "imageSha256": "be3e355a643939063d512fbcf719ef2a6b2cb06b12b0c102f47d7b7e9148a9c3"},
    },
    {
      id: "deep-autumn-drums-leap",
      name: "纵身一跃",
      kind: "main",
      barCount: 2,
      bars: [
        {"kick": [0, 6, 11, 13], "snare": [8, 12], "hihat": [0, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14]},
        {"kick": [0, 4, 6, 7, 9, 14], "snare": [8], "hihat": [0, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14]},
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee807ba7f2f9ab6d4b9964", "imageSha256": "a281dcd170e65b5ade3fe29c34364142dc18db20633490d054ae2856bfbc77f7"},
    },
    {
      id: "deep-autumn-drums-swing",
      name: "摇摆感节奏",
      kind: "main",
      barCount: 1,
      bars: [
        {"kick": [0, 2, 7, 9, 10, 13], "snare": [4, 12], "hihat": [0, 3, 6, 7, 8, 11, 13, 14, 15]},
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee80a5812fcd8fe3aa54f9", "imageSha256": "d9d423f7d98843159513f35dc4578071acdaf885128fbc16af36b950b8e5a44e", "note": "两份谱面音符相同，按来源保留为两个独立模板。"},
    },
    {
      id: "deep-autumn-drums-african-dance",
      name: "非洲舞步",
      kind: "main",
      barCount: 1,
      bars: [
        {"kick": [0, 2, 7, 9, 10, 13], "snare": [4, 12], "hihat": [0, 3, 6, 7, 8, 11, 13, 14, 15]},
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee80b28acacf3259b471ca", "imageSha256": "9be73272ce9f1f215e52c579d4e1c2f382dd04df8afdf11f33155eb6c821d561", "note": "两份谱面音符相同，按来源保留为两个独立模板。"},
    },
    {
      id: "deep-autumn-drums-chinese-groove",
      name: "中国鼓律动",
      kind: "main",
      barCount: 2,
      bars: [
        {"kick": [0, 6, 7, 8, 9], "snare": [12], "hihat": [2, 6, 10, 14]},
        {"kick": [0, 6, 7, 8, 9, 14], "snare": [12], "hihat": [2, 6, 10, 12, 14]},
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee804ea4a5d45dfd329218", "imageSha256": "d7ef7f79c796d66f95a3eb25bb6cf6a877071af4861f17f3300860eec14ff650", "note": "正文写 1 小节；谱面为 2 小节。2026-09-26 用户确认完整保留 2 小节，不压缩。"},
    },
    {
      id: "deep-autumn-drums-steady-bridge",
      name: "稳妥过渡",
      kind: "transition",
      barCount: 1,
      bars: [
        {"kick": [0, 1, 8, 10, 11], "snare": [4, 12, 14], "hihat": []},
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee80cda124e0a5fdbb6a44", "imageSha256": "108cff534e1312fb2a9f2d14edb75eb772256c571af452e92591302a2d3f8592"},
    },
    {
      id: "deep-autumn-drums-accelerate",
      name: "逐步加速",
      kind: "transition",
      barCount: 1,
      bars: [
        {"kick": [0, 4, 8, 10, 12, 13, 14, 15], "snare": [], "hihat": []},
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee80a5bc95e36b12c7b10a", "imageSha256": "1e884b33b0a0b5d438231a614fd033ecf91267e257909b6a02b79d9d7abf7f79"},
    },
    {
      id: "deep-autumn-drums-percussive-bridge",
      name: "敲击转场",
      kind: "transition",
      barCount: 1,
      bars: [
        {"kick": [8, 12], "snare": [3, 4, 6, 7, 9, 11, 13, 14], "hihat": []},
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee806fbb5efbad78843aef", "imageSha256": "bc2aafaa03fe39254921b0e00bda2e75227f811aca8e103052cc798d195da2e9"},
    },
    {
      id: "deep-autumn-drums-mixed-bridge",
      name: "混合转场",
      kind: "transition",
      barCount: 1,
      bars: [
        {"kick": [0, 2], "snare": [1, 4, 7, 8, 10, 12, 13], "hihat": []},
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee808f993fe22cbee87ae2", "imageSha256": "200f7c1cb8ac8ee2e455c310d65aa9b99a25f47e8968c9b47a5fa77f858f41ef"},
    },
  ],
  chord: [
    {
      id: "deep-autumn-chord-nostalgic-piano",
      name: "怀旧钢琴",
      kind: "main",
      barCount: 4,
      bars: [
        [[0, "G#2", 8], [0, "B2", 8], [0, "C#3", 8], [0, "E3", 8], [6, "D#3"], [10, "D#3"], [12, "B3"], [14, "F#3"]],
        [[0, "G#2", 8], [0, "B2", 8], [0, "C#3", 8], [0, "D#3", 8], [10, "G#3"], [12, "C#4"], [14, "B3"]],
        [[0, "E2", 4], [0, "G#2", 4], [0, "B2", 4], [0, "D#3", 4], [0, "F#3", 4], [2, "E3"], [6, "E3"], [8, "F#2", 4], [8, "B2", 4], [8, "D#3", 4], [8, "G#3", 4]],
        [[0, "G#2", 8], [0, "B2", 8], [0, "C#3", 8], [0, "D#3", 8], [12, "F#3"], [14, "B3"]],
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee800f8176c0180baf07a6", "imageSha256": "3f21c69718f0b247f3b84cf6c2340f01d91fae8b95a894f80241ae23e4a959cc"},
    },
    {
      id: "deep-autumn-chord-wind-valley",
      name: "风之谷",
      kind: "main",
      barCount: 2,
      bars: [
        [[0, "A2"], [0, "C#3"], [0, "E3"], [0, "G#3"], [2, "A2"], [2, "C#3"], [2, "E3"], [2, "G#3"], [6, "A2"], [6, "C#3"], [6, "E3"], [6, "G#3"], [8, "B2"], [9, "C#3"], [10, "B2"], [12, "F#3"], [13, "E3"], [14, "F#3"]],
        [[0, "G#2"], [0, "B2"], [0, "D#3"], [0, "F#3"], [2, "G#2"], [2, "B2"], [2, "D#3"], [2, "B3"], [6, "E3"], [8, "E3"], [9, "B2"], [11, "C#3"], [13, "B2"], [14, "G#2"], [15, "B2"]],
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee80068b2ec67f6bb7018a", "imageSha256": "7199e99e25a2155b0541d2d612e781188080ba13bfca6b619e089a1ffc5bcdac"},
    },
    {
      id: "deep-autumn-chord-parting-clouds",
      name: "拨云见雾",
      kind: "main",
      barCount: 2,
      bars: [
        [[0, "F#2", 4], [0, "A2", 4], [0, "C#3", 4], [0, "E3", 4], [0, "G#3", 4], [2, "F#3"], [5, "F#3"], [8, "F#2", 4], [8, "A2", 4], [8, "C#3", 4], [8, "E3", 4], [8, "G#3", 2], [9, "C#4"], [10, "G#3"], [12, "B3"]],
        [[0, "C#3", 4], [0, "E3", 4], [0, "G#3", 4], [0, "B3", 4], [5, "E3"], [6, "C#3"], [6, "F#3"], [7, "D#3"], [8, "B2", 4], [8, "F#3", 4], [8, "G#3", 4], [8, "B3", 4], [12, "G#2"], [12, "B2"], [12, "C#3"], [12, "E3"]],
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee80f68c72e143016d4aa3", "imageSha256": "977a250c44fd70154b32d9a3a25b7241485c92357dacb5f359c866e44f5077ad"},
    },
    {
      id: "deep-autumn-chord-passing-rain",
      name: "时雨时停",
      kind: "main",
      barCount: 2,
      bars: [
        [[1, "E3"], [2, "D#3"], [3, "E3"], [4, "G#3"], [5, "C#3"], [8, "E3"], [10, "D#3"], [12, "E3"], [12, "G#3"], [12, "B3"], [14, "C#3"], [14, "E3"], [14, "G#3"]],
        [[0, "C#3"], [0, "D#3"], [0, "G#3"], [0, "B3"], [3, "C#3"], [6, "C#3"], [6, "F#3"], [6, "B3"], [8, "G#3"], [9, "F#3"], [12, "D#3"], [12, "B3"], [14, "C#3"], [14, "E3"], [14, "G#3"]],
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee804a8956e110a3b4321e", "imageSha256": "0950047bf05fd1d7ec9ce48549c60ae368941aaaaf17bfd16f877097abdc7c5d"},
    },
    {
      id: "deep-autumn-chord-heartstrings",
      name: "扣人心弦",
      kind: "main",
      barCount: 2,
      bars: [
        [[0, "C#3", 2], [0, "E3", 2], [0, "G#3", 2], [0, "B3", 2], [6, "B2"], [6, "C#3"], [6, "E3"], [6, "G#3"], [10, "D#3"], [10, "F#3"], [10, "B3"]],
        [[0, "B2", 2], [0, "C#3", 2], [0, "D#3", 2], [0, "F#3", 2], [0, "B3", 2], [6, "B2"], [6, "E3"], [6, "G#3"], [6, "A3"], [10, "C3", 2], [10, "D#3", 2], [10, "F#3", 2], [10, "G#3", 2]],
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee8059addae0f939d7fd40", "imageSha256": "e40b9053a6599dd613575d44b26f02538eac91986aa61f6fb5f3b4cb59186a7d"},
    },
    {
      id: "deep-autumn-chord-rising-bridge",
      name: "递进感转场",
      kind: "transition",
      barCount: 1,
      bars: [
        [[0, "C#2"], [0, "E2"], [0, "B2"], [0, "D#3"], [4, "D#2"], [4, "G2"], [4, "A#2"], [4, "C#3"], [8, "E2"], [8, "G#2"], [8, "B2"], [8, "E3"], [12, "G#2"], [12, "C3"], [12, "D#3"], [12, "F#3"]],
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee80d9babfc1351a2b8111", "imageSha256": "abf799807b069efb6df470dd744bdbca00b2818f88eac9d3a97a138c4cca785f"},
    },
  ],
  bass: [
    {
      id: "deep-autumn-bass-drunken-bass",
      name: "醉拳贝斯",
      kind: "main",
      barCount: 1,
      bars: [
        [[0, "E0"], [2, "C#1"], [5, "F#0"], [8, "C#1"], [11, "G#0"], [12, "B0"]],
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee8076901bc85787af66e5", "imageSha256": "99467c32772805dbd1cd724134eaa88f4aa797f47c0b0260184e94865f6f14c5"},
    },
    {
      id: "deep-autumn-bass-bouncing-bass",
      name: "弹跳贝斯",
      kind: "main",
      barCount: 1,
      bars: [
        [[0, "G#0"], [5, "F#1"], [7, "F#1"], [8, "G#0"], [12, "B0"], [14, "C#1"]],
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee8034a1fece032180607f", "imageSha256": "c7f7c98ffae230df57ccbec6e8ff074464432bb0ea5c3638c907e3d7e2304697"},
    },
    {
      id: "deep-autumn-bass-returning-bass",
      name: "往返贝斯",
      kind: "main",
      barCount: 1,
      bars: [
        [[0, "C#1"], [4, "C#1"], [6, "B0"], [10, "C#1"], [14, "B0"]],
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee801a8b2ef0e566bfc290", "imageSha256": "c9727654bf893c14e1b62b77a834a33e96a10531577453b47f6da5d72599fda4"},
    },
    {
      id: "deep-autumn-bass-villain-bass",
      name: "反派贝斯",
      kind: "main",
      barCount: 1,
      bars: [
        [[0, "C#1"], [2, "E1"], [4, "C#1"], [8, "D#1"], [11, "E1"], [14, "C#1"]],
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee80db8475f87f436244fe", "imageSha256": "61a9c4528c7ebf191963aa1ddb2a9292a962fd070fb05dda51494e27692815e9"},
    },
    {
      id: "deep-autumn-bass-suspense-bass",
      name: "悬念贝斯",
      kind: "main",
      barCount: 1,
      bars: [
        [[2, "E1"], [4, "E1"], [7, "G#1"], [8, "C#1"], [10, "D#1"], [12, "G#0"]],
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee80268f4ddaf46eb0553b", "imageSha256": "629037e7b5afea6b52b5b38669dfba3a161543e62be979b8e56e6e06872e74d6"},
    },
    {
      id: "deep-autumn-bass-low-bridge",
      name: "低沉衔接",
      kind: "transition",
      barCount: 1,
      bars: [
        [[0, "C#1"], [8, "G#0"], [12, "G#0"], [13, "A0"], [14, "B0"]],
      ],
      source: {"url": "https://app.notion.com/3e5d48cb1eee80e68e98c91781fcc693", "imageSha256": "81354b5d056b45f7e3ba8c668a2c36b025c59fd74422e0d9cdfbb192c4e15b53"},
    },
  ],
  melody: [
    {
      id: "deep-autumn-melody-midnight-walk",
      name: "午夜漫步",
      kind: "main",
      barCount: 2,
      bars: [
        [[2, "C#4"], [3, "C#4"], [6, "D#4"], [8, "E4"], [10, "D#4"], [11, "E4"], [14, "C#4"]],
        [[2, "D#4"], [3, "D#4"], [6, "E4"], [8, "F#4"], [10, "B4"], [12, "D#4"], [14, "E4"]],
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee80bdb4cae041cb8a7913", "imageSha256": "4e468601b0ca75d363fe0706abbc8db5611b4500e6c6c512b4403107b1453076"},
    },
    {
      id: "deep-autumn-melody-between",
      name: "进退之间",
      kind: "main",
      barCount: 4,
      bars: [
        [[2, "F#4"], [3, "G#4"], [8, "F#4"], [9, "G#4"]],
        [[2, "B4"], [3, "F#4"], [4, "E4"], [5, "D#4"], [10, "F#4"], [11, "G#4"]],
        [[2, "D#4"], [3, "C#4"], [6, "C#4"], [8, "D#4"], [9, "E4"]],
        [[0, "E4"], [2, "D#4"], [5, "E4"], [8, "D#4"], [12, "G#4"]],
      ],
      source: {"url": "https://app.notion.com/3e4d48cb1eee80498da4ebb2b6021b07", "imageSha256": "50e8e9a22cc64b18f14ae0d79bafd46b4fca57b5ebb0dda9a3f46ce48ff90504"},
    },
    {
      id: "deep-autumn-melody-dim-club",
      name: "昏暗俱乐部",
      kind: "main",
      barCount: 4,
      bars: [
        [[0, "D#3"], [1, "E3"], [2, "C#4"], [6, "F#4"], [7, "E4"], [11, "G#4"], [12, "F#4"], [13, "B4"]],
        [[4, "E4"], [6, "F#4"], [7, "E4"], [12, "C#4"], [13, "B3"]],
        [[0, "D#3"], [1, "E3"], [2, "C#4"], [6, "F#4"], [7, "E4"], [11, "G#4"], [12, "F#4"], [13, "B4"]],
        [[4, "E4"], [6, "D#4"], [9, "C#4"], [12, "G#4"]],
      ],
      source: {"url": "https://app.notion.com/3e5d48cb1eee801faf38c6490c3d7b72", "imageSha256": "03b47328a4cf30ca671951da836610a29f0aff1ec5c0aca5f8473d64e679ed18"},
    },
    {
      id: "deep-autumn-melody-eye-contact",
      name: "对视",
      kind: "main",
      barCount: 2,
      bars: [
        [[1, "B3"], [2, "C#4"], [4, "B3"], [5, "E4"], [8, "C#4"]],
        [[0, "B3"], [1, "C#4"], [3, "B3"], [4, "E4"], [7, "C#4"], [8, "B3"], [9, "C#4"]],
      ],
      source: {"url": "https://app.notion.com/3e5d48cb1eee80a2b3f3ed877e42ac17", "imageSha256": "2ae009d4b37e3b3b075593ff643f734576523f814b26fe22728bf4b0365963cd"},
    },
    {
      id: "deep-autumn-melody-natasha",
      name: "娜塔莎的期待",
      kind: "transition",
      barCount: 1,
      bars: [
        [[10, "G#3"], [11, "A3"], [12, "C4"], [13, "C#4"], [14, "E4"], [15, "G#4"]],
      ],
      source: {"url": "https://app.notion.com/3e5d48cb1eee80c68b2ecb7012a9d10f", "imageSha256": "da85e7707565ac718c7602bc7059f07558a5bffdad85e0f1bba71597edbc00d5"},
    },
  ],
};
