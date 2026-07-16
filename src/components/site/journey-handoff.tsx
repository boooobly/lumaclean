import Image from "next/image";
import type {EditorialContent} from "@/lib/site-content";

export function JourneyHandoff({copy}: {copy: EditorialContent["handoff"]}) {
  return (
    <section className="handoff" id="handoff">
      <div className="shell handoff-inner">
        <Image
          className="handoff-route"
          src="/media/floorplan-route.svg"
          alt=""
          width={1400}
          height={900}
        />
        <div className="handoff-marker" aria-hidden="true">
          <span>04</span>
          <i />
        </div>
        <div className="handoff-copy">
          <span className="kicker">{copy.kicker}</span>
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
          <small>{copy.scroll}</small>
        </div>
      </div>
    </section>
  );
}
