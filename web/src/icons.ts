import {
  Sun,
  Moon,
  Cloud,
  Cpu,
  Star,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Target,
  HelpCircle,
  Volume2,
  Sparkles,
  RotateCcw,
  User,
  Sliders,
  ListFilter,
  X,
  Play,
  Pause,
  History,
  Zap,
  Mic,
  AudioLines,
  Gauge,
  Server,
  HardDrive,
  Timer,
  ExternalLink,
  Trophy,
  Lightbulb,
  Info,
  Palette,
  Headphones,
  Activity,
  type IconNode,
} from "lucide";

const iconMap: Record<string, IconNode> = {
  sun: Sun,
  moon: Moon,
  cloud: Cloud,
  cpu: Cpu,
  star: Star,
  trash: Trash2,
  copy: Copy,
  check: Check,
  "chevron-right": ChevronRight,
  "chevron-down": ChevronDown,
  "chevrons-up-down": ChevronsUpDown,
  target: Target,
  help: HelpCircle,
  volume: Volume2,
  sparkles: Sparkles,
  "rotate-ccw": RotateCcw,
  user: User,
  sliders: Sliders,
  filter: ListFilter,
  close: X,
  play: Play,
  pause: Pause,
  history: History,
  zap: Zap,
  mic: Mic,
  audiolines: AudioLines,
  gauge: Gauge,
  server: Server,
  "hard-drive": HardDrive,
  timer: Timer,
  "external-link": ExternalLink,
  trophy: Trophy,
  lightbulb: Lightbulb,
  info: Info,
  palette: Palette,
  headphones: Headphones,
  activity: Activity,
};

interface IconOptions {
  size?: number | string;
  className?: string;
  strokeWidth?: number | string;
  fill?: string;
  color?: string;
}

export function icon(name: keyof typeof iconMap | string, options: IconOptions = {}): string {
  const iconNode = iconMap[name];
  if (!iconNode) {
    console.warn(`[Icons] Unknown icon "${name}"`);
    return "";
  }

  const size = options.size ?? 15;
  const strokeWidth = options.strokeWidth ?? 2;
  const fill = options.fill ?? "none";
  const stroke = options.color ?? "currentColor";
  const className = options.className ? `lucide-icon lucide-${name} ${options.className}` : `lucide-icon lucide-${name}`;

  const children = iconNode
    .map(([tag, childAttrs]) => {
      const childAttrStr = Object.entries(childAttrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      return `<${tag} ${childAttrStr}></${tag}>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">${children}</svg>`;
}
