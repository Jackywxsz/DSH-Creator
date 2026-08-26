export type PresentationAspect = "16x9" | "3x4";

const ASPECT_LABEL: Record<PresentationAspect, string> = {
  "16x9": "16:9",
  "3x4": "3:4",
};

export function buildPresentationInstruction(input: {
  id: string;
  folderPath: string;
  aspect: PresentationAspect;
}): string {
  const outputPath = `${input.folderPath}/演示/${input.id}-${input.aspect}.html`;
  return [
    `请为 contentId=${JSON.stringify(input.id)} 制作 Jacky Motion 演示动画。`,
    "必须调用 $jacky-motion2-0，并完整遵循 P1 审稿、P2 分镜、P3 选风格三个确认门，不得直接跳到 HTML。",
    `画幅选择 ${ASPECT_LABEL[input.aspect]}。读取这条真实内容的 script.md，最终把单文件 HTML 写入 ${JSON.stringify(outputPath)}。`,
    "完成后运行 Skill 自带的静态校验和浏览器布局检查。不要只把 HTML 发在对话里。",
  ].join("\n");
}
