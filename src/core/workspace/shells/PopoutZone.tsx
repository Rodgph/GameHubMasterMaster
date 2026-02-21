import { forwardRef } from "react";

type PopoutZoneProps = {
  active: boolean;
  altActive: boolean;
};

export const PopoutZone = forwardRef<HTMLElement, PopoutZoneProps>(function PopoutZone(
  { active, altActive },
  ref,
) {
  return (
    <section ref={ref} className={`popout-zone ${active ? "active" : ""}`}>
      <strong>Solte aqui para abrir em janela</strong>
      <span>{altActive ? "Alt ativo" : "Dica: segure Alt e solte para popout"}</span>
    </section>
  );
});
