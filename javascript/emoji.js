/* ============================================================
   GLOBAL EMOJI PICKER — Vexec
   Shared across Write page + Comment inputs.
   Usage:  window.VexecEmoji.toggle(inputElement)
   ============================================================ */
(function () {
  "use strict";

  /* ============================================================
     EMOJI DATA
     ============================================================ */
  const EMOJI_DATA = {
    smileys: [
      ["😀", "grinning happy smile"], ["😃", "smile happy joy"],
      ["😄", "grin happy joy"], ["😁", "beam grin happy"],
      ["😆", "laugh happy satisfied"], ["😅", "sweat smile nervous"],
      ["🤣", "rofl laugh lol"], ["😂", "joy tears laugh"],
      ["🙂", "slight smile"], ["🙃", "upside down silly"],
      ["😉", "wink flirt"], ["😊", "blush smile shy"],
      ["😇", "innocent angel halo"], ["🥰", "love hearts adore"],
      ["😍", "heart eyes love"], ["🤩", "star struck wow"],
      ["😘", "kiss blow love"], ["😗", "kiss"],
      ["😚", "kiss closed eyes"], ["😙", "kiss smile"],
      ["🥲", "smile tear happy sad"], ["😋", "yum tasty"],
      ["😛", "tongue playful"], ["😜", "wink tongue"],
      ["🤪", "zany crazy wild"], ["😝", "tongue squint"],
      ["🤑", "money mouth rich"], ["🤗", "hug happy"],
      ["🤭", "oops shy giggle"], ["🤫", "shush quiet secret"],
      ["🤔", "thinking ponder"], ["🤐", "zipper mouth"],
      ["🤨", "raised eyebrow skeptic"], ["😐", "neutral meh"],
      ["😑", "expressionless blank"], ["😶", "no mouth speechless"],
      ["😏", "smirk sly"], ["😒", "unamused annoyed"],
      ["🙄", "eye roll whatever"], ["😬", "grimace awkward"],
      ["🤥", "lying pinocchio"], ["😌", "relieved calm"],
      ["😔", "pensive sad"], ["😪", "sleepy tired"],
      ["🤤", "drool"], ["😴", "sleeping zzz"],
      ["😷", "mask sick"], ["🤒", "thermometer sick"],
      ["🤕", "hurt bandage"], ["🤢", "nauseated sick"],
      ["🤮", "vomit sick"], ["🤧", "sneeze sick"],
      ["🥵", "hot sweating"], ["🥶", "cold freezing"],
      ["🥴", "woozy drunk"], ["😵", "dizzy dead"],
      ["🤯", "exploding mind blown"], ["🤠", "cowboy hat"],
      ["🥳", "party face celebrate"], ["🥸", "disguise"],
      ["😎", "cool sunglasses"], ["🤓", "nerd geek"],
      ["🧐", "monocle inspect"], ["😕", "confused"],
      ["😟", "worried concerned"], ["🙁", "slight frown"],
      ["😮", "surprised open mouth"], ["😯", "hushed"],
      ["😲", "astonished shock"], ["😳", "flushed embarrassed"],
      ["🥺", "pleading puppy eyes"], ["😦", "frown open"],
      ["😧", "anguished"], ["😨", "fearful scared"],
      ["😰", "anxious sweat"], ["😥", "sad relieved"],
      ["😢", "cry sad tear"], ["😭", "sob cry loud"],
      ["😱", "scream fear shock"], ["😖", "confounded"],
      ["😣", "persevere struggle"], ["😞", "disappointed"],
      ["😓", "downcast sweat"], ["😩", "weary tired"],
      ["😫", "tired fed up"], ["🥱", "yawn bored"],
      ["😤", "triumph huff steam"], ["😡", "rage angry red"],
      ["😠", "angry mad"], ["🤬", "cursing swear"],
      ["😈", "devil smile purple"], ["👿", "devil angry"],
      ["💀", "skull dead"], ["💩", "poop shit"],
      ["🤡", "clown"], ["👻", "ghost boo"],
      ["👽", "alien ufo"], ["👾", "space invader game"],
      ["🤖", "robot bot"], ["🎃", "pumpkin halloween"],
    ],
    gestures: [
      ["👍", "thumbs up like good"], ["👎", "thumbs down dislike"],
      ["👌", "ok perfect"], ["🤌", "pinched fingers italian"],
      ["🤏", "pinch small"], ["✌️", "peace victory"],
      ["🤞", "crossed fingers luck"], ["🤟", "love you gesture"],
      ["🤘", "rock metal horns"], ["🤙", "call me shaka"],
      ["👈", "point left"], ["👉", "point right"],
      ["👆", "point up"], ["👇", "point down"],
      ["☝️", "index up"], ["✋", "hand stop"],
      ["🤚", "raised back"], ["🖐️", "hand fingers"],
      ["🖖", "vulcan spock"], ["👋", "wave hi bye"],
      ["🤝", "handshake deal"], ["🙏", "pray please thanks"],
      ["✊", "fist bump power"], ["👊", "punch fist"],
      ["🤛", "left fist bump"], ["🤜", "right fist bump"],
      ["👏", "clap applause"], ["🙌", "raised hands hooray"],
      ["👐", "open hands"], ["🤲", "palms up"],
      ["💪", "muscle strong"], ["🦾", "mech arm robot"],
      ["🖕", "middle finger"], ["✍️", "writing hand"],
      ["💅", "nails polish"], ["🫶", "heart hands"],
      ["🫰", "finger heart"],
    ],
    hearts: [
      ["❤️", "red heart love"], ["🧡", "orange heart"],
      ["💛", "yellow heart"], ["💚", "green heart"],
      ["💙", "blue heart"], ["💜", "purple heart"],
      ["🖤", "black heart"], ["🤍", "white heart"],
      ["🤎", "brown heart"], ["💔", "broken heart"],
      ["❣️", "heart exclamation"], ["💕", "two hearts love"],
      ["💞", "revolving hearts"], ["💓", "beating heart"],
      ["💗", "growing heart"], ["💖", "sparkle heart"],
      ["💘", "heart arrow cupid"], ["💝", "heart gift"],
      ["💟", "heart decoration"], ["♥️", "heart suit"],
      ["😻", "heart eyes cat"], ["💋", "kiss mark"],
      ["🔥", "fire hot"], ["✨", "sparkles magic"],
      ["⭐", "star"], ["🌟", "glowing star"],
      ["💫", "dizzy star"], ["⚡", "lightning zap"],
    ],
    animals: [
      ["🐶", "dog puppy"], ["🐱", "cat kitten"],
      ["🐭", "mouse"], ["🐹", "hamster"],
      ["🐰", "rabbit bunny"], ["🦊", "fox"],
      ["🐻", "bear"], ["🐼", "panda"],
      ["🐨", "koala"], ["🐯", "tiger"],
      ["🦁", "lion"], ["🐮", "cow"],
      ["🐷", "pig"], ["🐸", "frog"],
      ["🐵", "monkey"], ["🐔", "chicken"],
      ["🐧", "penguin"], ["🐦", "bird"],
      ["🦆", "duck"], ["🦉", "owl"],
      ["🦇", "bat"], ["🐺", "wolf"],
      ["🐗", "boar"], ["🐴", "horse"],
      ["🦄", "unicorn magic"], ["🐝", "bee"],
      ["🐛", "bug caterpillar"], ["🦋", "butterfly"],
      ["🐌", "snail"], ["🐞", "ladybug"],
      ["🐢", "turtle"], ["🐍", "snake"],
      ["🦖", "t-rex dinosaur"], ["🦕", "dinosaur"],
      ["🐙", "octopus"], ["🦑", "squid"],
      ["🦐", "shrimp"], ["🦀", "crab"],
      ["🐡", "blowfish"], ["🐠", "tropical fish"],
      ["🐟", "fish"], ["🐬", "dolphin"],
      ["🐳", "whale"], ["🦈", "shark"],
    ],
    food: [
      ["🍕", "pizza"], ["🍔", "burger hamburger"],
      ["🍟", "fries"], ["🌭", "hot dog"],
      ["🍿", "popcorn movie"], ["🥓", "bacon"],
      ["🍳", "egg fried"], ["🧇", "waffle"],
      ["🥞", "pancakes"], ["🍞", "bread"],
      ["🥐", "croissant"], ["🥖", "baguette"],
      ["🧀", "cheese"], ["🥗", "salad"],
      ["🥪", "sandwich"], ["🌮", "taco"],
      ["🌯", "burrito"], ["🍜", "ramen noodles"],
      ["🍝", "spaghetti pasta"], ["🍣", "sushi"],
      ["🍱", "bento box"], ["🍛", "curry rice"],
      ["🍚", "rice"], ["🍦", "ice cream"],
      ["🍰", "cake slice"], ["🎂", "birthday cake"],
      ["🍫", "chocolate"], ["🍬", "candy"],
      ["🍭", "lollipop"], ["🍯", "honey"],
      ["🍎", "apple red"], ["🍌", "banana"],
      ["🍇", "grapes"], ["🍓", "strawberry"],
      ["🍑", "peach"], ["🍒", "cherry"],
      ["🥝", "kiwi"], ["🍍", "pineapple"],
      ["🥥", "coconut"], ["🥑", "avocado"],
      ["☕", "coffee hot"], ["🍵", "tea"],
      ["🍺", "beer"], ["🍷", "wine"],
      ["🥂", "champagne cheers"], ["🍾", "champagne bottle"],
      ["🧊", "ice"], ["🥤", "cup straw soda"],
    ],
    nature: [
      ["🌸", "cherry blossom flower"], ["🌹", "rose flower"],
      ["🌺", "hibiscus flower"], ["🌻", "sunflower"],
      ["🌷", "tulip flower"], ["🌼", "daisy flower"],
      ["🌱", "seedling plant"], ["🌲", "tree evergreen"],
      ["🌳", "tree"], ["🌴", "palm tree"],
      ["🌵", "cactus"], ["🌾", "rice wheat"],
      ["🌿", "herb leaf"], ["☘️", "shamrock clover"],
      ["🍀", "four leaf clover luck"], ["🍁", "maple leaf"],
      ["🍂", "fallen leaf autumn"], ["🍃", "leaf wind"],
      ["🌍", "earth globe"], ["🌙", "moon crescent"],
      ["🌞", "sun face"], ["⛅", "cloud sun"],
      ["☁️", "cloud"], ["🌧️", "rain cloud"],
      ["⛈️", "thunder storm"], ["❄️", "snowflake cold"],
      ["🔥", "fire flame"], ["💧", "water drop"],
      ["🌊", "wave ocean"], ["🌈", "rainbow"],
    ],
    objects: [
      ["💡", "idea bulb"], ["📱", "phone mobile"],
      ["💻", "laptop computer"], ["⌨️", "keyboard"],
      ["🖱️", "mouse computer"], ["🖥️", "desktop monitor"],
      ["📷", "camera photo"], ["📸", "camera flash"],
      ["🎥", "movie camera"], ["📺", "tv television"],
      ["🎵", "music note"], ["🎶", "music notes"],
      ["🎤", "microphone mic"], ["🎧", "headphones"],
      ["🎸", "guitar"], ["🎹", "piano keyboard"],
      ["🥁", "drum"], ["🎺", "trumpet"],
      ["📚", "books"], ["📖", "book open"],
      ["📝", "memo write"], ["✏️", "pencil"],
      ["🖊️", "pen"], ["📎", "paperclip"],
      ["📌", "pushpin"], ["📁", "folder"],
      ["📦", "package box"], ["🔑", "key"],
      ["🔒", "lock"], ["🔓", "unlock"],
      ["🔔", "bell"], ["💎", "gem diamond"],
      ["💰", "money bag"], ["💸", "money wings"],
      ["🎁", "gift present"], ["🎈", "balloon"],
      ["🎉", "party popper"], ["🎊", "confetti"],
      ["🏆", "trophy win"], ["🥇", "gold medal"],
      ["⚽", "soccer ball"], ["🏀", "basketball"],
      ["🎮", "game controller"], ["🕹️", "joystick"],
    ],
    symbols: [
      ["✅", "check yes done"], ["❌", "x cross no"],
      ["⭕", "circle red"], ["❗", "exclamation"],
      ["❓", "question"], ["💯", "hundred perfect"],
      ["🔴", "red circle"], ["🟠", "orange circle"],
      ["🟡", "yellow circle"], ["🟢", "green circle"],
      ["🔵", "blue circle"], ["🟣", "purple circle"],
      ["⚫", "black circle"], ["⚪", "white circle"],
      ["🔶", "orange diamond"], ["🔷", "blue diamond"],
      ["🔸", "small orange diamond"], ["🔹", "small blue diamond"],
      ["➡️", "right arrow"], ["⬅️", "left arrow"],
      ["⬆️", "up arrow"], ["⬇️", "down arrow"],
      ["🔄", "refresh loop"], ["🔃", "reload"],
      ["➕", "plus add"], ["➖", "minus remove"],
      ["➗", "divide"], ["✖️", "multiply"],
      ["♻️", "recycle"], ["⚜️", "fleur de lis"],
      ["🔱", "trident"], ["💠", "diamond blue"],
      ["✨", "sparkles"], ["💫", "dizzy"],
      ["⚡", "lightning"], ["🔥", "fire"],
      ["💥", "boom collision"], ["💢", "anger symbol"],
      ["💤", "zzz sleep"], ["💬", "speech bubble"],
      ["💭", "thought bubble"], ["🗯️", "anger bubble"],
    ],
  };

  /* ============================================================
     STATE
     ============================================================ */
  let picker = null;
  let grid = null;
  let search = null;
  let empty = null;
  let tabs = null;
  let targetInput = null;
  let isOpen = false;
  let searchTimer = null;

  /* ============================================================
     ENSURE DOM
     ============================================================ */
  function ensure() {
    if (picker) return true;
    picker = document.getElementById("emoji-picker");
    if (!picker) return false;

        grid = document.getElementById("emoji-grid");
    search = document.getElementById("emoji-search");
    empty = document.getElementById("emoji-empty");
    tabs = document.getElementById("emoji-tabs");

    tabs?.addEventListener("click", onTabClick);
    search?.addEventListener("input", onSearchInput);
    grid?.addEventListener("click", onEmojiClick);

    // 🔑 دکمه ضرب (بستن) — سراسری
    const closeBtn = picker.querySelector(".emoji-close");
    closeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      close();
    });

    render("smileys");
    return true;
  }

  /* ============================================================
     HANDLERS
     ============================================================ */
  function onTabClick(e) {
    const tab = e.target.closest(".emoji-tab");
    if (!tab) return;
    tabs.querySelectorAll(".emoji-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    if (search) search.value = "";
    render(tab.dataset.cat);
  }

  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = search.value.trim().toLowerCase();
      if (!q) {
        const active = tabs?.querySelector(".emoji-tab.active");
        render(active ? active.dataset.cat : "smileys");
        return;
      }
      doSearch(q);
    }, 120);
  }

  function onEmojiClick(e) {
    const btn = e.target.closest(".emoji-btn");
    if (!btn) return;
    insert(btn.textContent);
  }

  function onDocClick(e) {
    if (!isOpen) return;
    if (e.target.closest("#emoji-picker")) return;
    if (e.target.closest('[data-action="emoji"]')) return;
    if (e.target.closest(".comment-emoji-btn")) return;
    close();
  }

  function onKeydown(e) {
    if (e.key === "Escape" && isOpen) close();
  }

  /* ============================================================
     RENDER
     ============================================================ */
  function render(cat) {
    if (!grid) return;
    const list = EMOJI_DATA[cat] || [];
    grid.innerHTML = list
      .map(([c]) => `<button class="emoji-btn" type="button">${c}</button>`)
      .join("");
    if (empty) empty.hidden = true;
    grid.hidden = false;
  }

  function doSearch(q) {
    const seen = new Set();
    const results = [];
    Object.values(EMOJI_DATA).forEach((list) => {
      list.forEach(([c, tags]) => {
        if (tags.includes(q) && !seen.has(c)) {
          seen.add(c);
          results.push(c);
        }
      });
    });
    const unique = results.slice(0, 120);

    if (unique.length === 0) {
      grid.innerHTML = "";
      grid.hidden = true;
      if (empty) {
        empty.hidden = false;
        if (window.lucide) window.lucide.createIcons();
      }
      return;
    }
    grid.innerHTML = unique
      .map((c) => `<button class="emoji-btn" type="button">${c}</button>`)
      .join("");
    if (empty) empty.hidden = true;
    grid.hidden = false;
  }

  /* ============================================================
     INSERT
     ============================================================ */
  function insert(text) {
    if (!targetInput) return;
    const start = targetInput.selectionStart ?? targetInput.value.length;
    const end = targetInput.selectionEnd ?? targetInput.value.length;
    const before = targetInput.value.substring(0, start);
    const after = targetInput.value.substring(end);
    targetInput.value = before + text + after;
    const newPos = start + text.length;
    targetInput.selectionStart = targetInput.selectionEnd = newPos;
    targetInput.focus();
    targetInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /* ============================================================
     API
     ============================================================ */
  /* ---------- Mobile detection (cached) ---------- */
  const IS_MOBILE =
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    document.body.classList.contains("is-mobile") ||
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

  function open(inputEl) {
    if (!ensure()) return;
    targetInput = inputEl || document.activeElement || null;
    isOpen = true;

    /* On mobile: blur anything currently focused to close the keyboard */
    if (IS_MOBILE) {
      const active = document.activeElement;
      if (active && active !== document.body && active.blur) {
        active.blur();
      }
    }

    picker.classList.add("open");
    picker.setAttribute("aria-hidden", "false");
    if (window.lucide) window.lucide.createIcons({ root: picker });

    /* Desktop only: auto-focus the emoji search input */
    if (!IS_MOBILE) {
      setTimeout(() => search?.focus(), 100);
    }
  }

  function close() {
    if (!picker) return;
    isOpen = false;
    picker.classList.remove("open");
    picker.setAttribute("aria-hidden", "true");
    if (search) search.value = "";
    const active = tabs?.querySelector(".emoji-tab.active");
    render(active ? active.dataset.cat : "smileys");

    /* On mobile: return focus to the original input → keyboard reopens */
    if (IS_MOBILE && targetInput && typeof targetInput.focus === "function") {
      const el = targetInput;
      setTimeout(() => {
        try {
          el.focus({ preventScroll: true });
          if (typeof el.setSelectionRange === "function") {
            const len = el.value ? el.value.length : 0;
            el.setSelectionRange(len, len);
          }
        } catch (_) {
          /* element might be gone — ignore */
        }
      }, 80);
    }

    targetInput = null;
  }
  
  function toggle(inputEl) {
    if (isOpen && targetInput === inputEl) close();
    else open(inputEl);
  }

  window.VexecEmoji = {
    open,
    close,
    toggle,
    get isOpen() {
      return isOpen;
    },
  };

  document.addEventListener("click", onDocClick, true);
  document.addEventListener("keydown", onKeydown);
})();