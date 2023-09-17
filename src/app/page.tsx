import Link from "next/link";

export default function Home() {
  return (
    <div className="flex w-[70%] lg:w-[50%] h-full">
      <div className="w-full flex flex-col items-center justify-center gap-24">
        <div className="fw-full lex flex-col items-center justify-center gap-10">
          <h1 className="text-5xl font-thin text-slate-200 text-center">
            Experience the power of{" "}
            <span className="font-medium text-white">DeFi</span> with
            <span className="font-medium text-white"> Metavoeux.</span>
          </h1>
          <p className="text-md text-slate-300 text-center mt-10">
            We have done it carefully and simply.
            <br /> Combined with the ingredients make for beautiful landings.
          </p>
        </div>

        <Link
          href={"/market"}
          className="btn w-60 h-12 text-sm flex items-center justify-center"
        >
          Explore
        </Link>
      </div>
    </div>
  );
}
