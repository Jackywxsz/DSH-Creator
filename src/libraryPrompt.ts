export interface LibraryPromptSource {
  libraryRoot: string;
  dataDir: string;
  cache?: { libraryRoot: string } | undefined;
}

interface PromptSectionHost {
  systemPrompt: {
    section: (section: {
      name: string;
      order: number;
      text: string | (() => string);
    }) => () => void;
  };
}

export function resolvePromptLibraryRoot(source: LibraryPromptSource): string {
  return source.cache?.libraryRoot ?? source.libraryRoot;
}

export function libraryConventionText(libraryRoot: string, dataDir: string): string {
  return [
    `oil 的视频内容以磁盘文件为准，目录是 ${libraryRoot}。`,
    "一集一个子文件夹，名字是 YYYY-MM-DD_可读标题。列出这个目录就是片库；打开一集先列出那个文件夹，再读需要的文件。",
    "约定文件：topic.md 选题；script.md 口播脚本；公众号文章/<标题>.md 已转写文章，配图在 公众号文章/images/；publish-package.json 只放标题和 tags，不写平台长文案；*.mp4/*.mov 成片（_subtitled 为烧录版）；*.srt/*.ass 字幕；*_3x4.png *_4x3.png *_16x9.png 封面。",
    "读或改这些内容，用系统自带的列文件、读文件、写文件工具。不要为了看一集再调插件工具。",
    `插件工具只做文件做不到的事：按约定建文件夹、绑/开 Screen Studio、等导出、生成或烧录字幕、生成封面、同步已发布数据、整理文件夹名。工作台状态在 ${dataDir}/overlay.json，不是正文。`,
  ].join("\n");
}

export function registerLibraryPrompt(ctx: PromptSectionHost, source: LibraryPromptSource): () => void {
  return ctx.systemPrompt.section({
    name: "oil:library",
    order: 120,
    text: () => libraryConventionText(resolvePromptLibraryRoot(source), source.dataDir),
  });
}
