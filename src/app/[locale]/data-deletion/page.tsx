import {LegalPage, legalMetadata} from "@/components/site/legal-page";

type Props = {params: Promise<{locale: string}>};
export const generateMetadata = ({params}: Props) => legalMetadata(params, "data-deletion");
export default function Page({params}: Props) {return <LegalPage params={params} kind="data-deletion"/>;}
