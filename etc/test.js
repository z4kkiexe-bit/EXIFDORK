async function getdata() {
    const oFetch = await fetch("http://localhost:3888/")
    const oResponse = await oFetch.json()
    console.log(oResponse.name, oResponse.status)
}
getdata()