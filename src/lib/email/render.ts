export interface TemplateContext {
  publisher: string;
  period: string;
  units_sold: string;
  gross_revenue: string;
  royalty_rate: string;
  royalty_due: string;
  carried_in: string;
  carried_out: string;
  status: string;
}

export function renderTemplate(template: string, ctx: TemplateContext): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) => {
    return key in ctx ? ctx[key as keyof TemplateContext] : match;
  });
}
