const express = require('express');
const router = express.Router();
ObjectId = require('mongodb').ObjectID;
Election = require('../../models/Election.model');
Candidate = require('../../models/Candidate.model');
Admin = require('../../models/Admin.model');
BlockchainApp = require('../../utils/blockchain');

router.get('/', (req,res) => {
    Election.find().then((docs) => {
        res.json({elections:docs});
    });
});

router.get('/:id', (req,res) => {
    electionObj = {};
    electionObj._id = ObjectId(req.params.id);
    Election.find(electionObj).then((docs) => {
        res.json({elections:docs});
    });
});

router.post('/', (req,res) => {
    if(!req.body.elections)
    {
        return res.status(400).json({msg:"Invalid format.", input:req.body});
    }
    var elections = Array();
    for(i=0; i<req.body.elections.length; i+=1)
    {
        if(!req.body.elections[i].Name)
        {
            return res.status(400).json({msg:"Field not included : Name", input:req.body});
        }
        if(!req.body.elections[i].Port)
        {
            return res.status(400).json({msg:"Field not included : Port", input:req.body});
        }
        Election.find().then((docs) => {
            for(i=0; i<docs.length; i++)
            {
                if(docs[i].Port === req.body.elections[i].Port)
                {
                    return res.status(400).json({msg:"Blockchain server already in use by another election"});
                }
            }
        });
        var election = {};
        election.Name = req.body.elections[i].Name;
        election.Port = req.body.elections[i].Port;
        election.Votes_Counted = false;
        var electionObj = new Election(election);
        elections.push(electionObj);
    }
    Election.create(elections).then((data)=> {
        var responseObj = {};
        responseObj.msg = "Election inserted successfully";
        responseObj.input = data;
        res.status(201).json(responseObj);
    }).catch((err)=>{
        console.log(err);
        return res.status(500).json({msg:"Internal Server Error"}); 
    });
});

router.post('/:id/count_votes', (req,res) => {
    if(!req.query.from)
    {
        return res.status(400).json({msg:"Fields to be included : from"});
    }
    electionQuery = {};
    electionQuery._id = ObjectId(req.params.id);
    Election.find(electionQuery).then((elections) => {
        if(elections.length <= 0)
        {
            return res.status(400).json({msg:"Invalid election ID"});
        }
        if(elections[i].Votes_Counted)
        {
            return res.status(400).json({msg:"Votes have already been counted"});
        }
        var adminQuery = {};
        adminQuery._id = ObjectId(req.query.from);
        Admin.find(adminQuery).then((admins) => {
            if(admins.length <= 0)
            {
                return res.status(400).json({msg:"Invalid from admin ID"});
            }
            var fromObj = {};
            fromObj.from = admins[0].Public_Key;
            var candidateQuery = {};
            candidateQuery.Election_ID = ObjectId(req.params.id);
            BlockchainApp.initBlockchainServer(elections[0].Port);
            var electionContract = BlockchainApp.getSmartContract();
            electionContract.deployed().then((instance) => {
                instance.countAllVotes(elections[0].Nonces, fromObj).then(() => {
                    Candidate.find(candidateQuery).then((candidates) => {
                        candidates.forEach((candidate,index) => {
                            var candidatePubKey = candidate.Public_Key;
                            electionContract.deployed().then((instance) => {
                                instance.getVoteCountCandidate(candidatePubKey, fromObj).then((voteCount) => {
                                    var candidateObj = {};
                                    candidateObj.Total_Votes = voteCount;
                                    candidateQuery = {};
                                    candidateQuery._id = ObjectId(candidate._id);
                                    Candidate.updateOne(candidateQuery, candidateObj, (err) => {
                                        if(err)
                                        {
                                            console.log(err);
                                        }
                                        console.log("Vote count updated for "+String(candidate._id));
                                        if(index === candidates.length-1)
                                        {
                                            electionObj = {};
                                            electionObj.Votes_Counted = true;
                                            Election.updateOne(electionQuery, electionObj, (err) => {
                                                if(err)
                                                {
                                                    return res.status(500).json({msg:"Problem occurred when updating vote count status in database"});
                                                }
                                                return res.status(200).json({msg:"Vote counting completed"});
                                            });
                                        }
                                    });
                                }).catch((err) => {
                                    console.log(err);
                                });
                            }).catch((err) => {
                                console.log(err);
                            });
                        });
                    }).catch((err) => {
                    console.log(err);
                    res.status(500).json({msg:"Problem with retrieving candidates from database"});
                    });
                }).catch((err) => {
                    console.log(err);
                    res.status(500).json({msg:"Problem occurred when counting votes in blockchain"});
                });
            }).catch((err) => {
                console.log(err);
                res.status(500).json({msg:"Problem with deploying smart contract"});
            });
        }).catch((err) => {
            console.log(err);
            res.status(500).json({msg:"Problem with retrieving admins from database"});
        });
    }).catch((err) => {
        console.log(err);
        res.status(500).json({msg:"Problem with retrieving elections from database"});
    });
});

router.put('/:id/date', (req,res) => {
    if(!req.body.Start_Datetime || !req.body.End_Datetime)
    {
        return res.status(400).json({msg:"Fields to be included : Start_Datetime, End_Datetime", input:req.body});
    }
    if(!req.query.from)
    {
        return res.status(400).json({msg:"Query fields to be included : from", query:req.query});
    }
    electionQuery = {};
    electionQuery._id = ObjectId(req.params.id);
    Election.find(electionQuery).then((elections) => {
        if(elections.length === 0)
        {
            return res.status(400).json({msg:"Invalid election ID"});
        }
        var adminQuery = {};
        adminQuery._id = ObjectId(req.query.from);
        Admin.find(adminQuery).then((admins) => {
            if(admins.length === 0)
            {
                return res.status(400).json({msg:"Invalid from admin ID"});
            }
            var fromObj = {};
            fromObj.from = admins[0].Public_Key;
            BlockchainApp.initBlockchainServer(elections[0].Port);
            var electionContract = BlockchainApp.getSmartContract();
            electionContract.deployed().then((instance) => {
                instance.setElectionDate(req.body.Start_Datetime, req.body.End_Datetime, fromObj).then(() => {
                    var electionUpdate = {};
                    electionUpdate.Start_Datetime = req.body.Start_Datetime;
                    electionUpdate.End_Datetime = req.body.End_Datetime;
                    Election.updateOne(electionQuery,electionUpdate, (err) => {
                        if(err)
                        {
                            return res.status(500).json({msg:"Some problem occurred while updating start and end date of election in database"});
                        }
                        return res.status(200).json({msg:"Election date set successfully", data:req.body});
                    });
                }).catch((err) => {
                    console.log(err);
                    return res.status(500).json({msg:"Problem occurred while trying set election date in blockchain"});
                });
            }).catch((err) => {
            console.log(err);
            return res.status(500).json({msg:"Problem occurred while trying to deploy smart contract"});
            });

        }).catch((err) => {
            console.log(err);
            return res.status(500).json({msg:"Problem occurred while trying to retrieve admins from database"});
        });
    }).catch((err) => {
        console.log(err);
        return res.status(500).json({msg:"Problem occurred while trying to retrieve elections from database"});
    });
});

router.put('/:id/vote_count_date', (req,res) => {
    if(!req.body.Vote_Count_Start_Datetime || !req.body.Vote_Count_End_Datetime)
    {
        return res.status(400).json({msg:"Fields to be included : Start_Datetime, End_Datetime", input:req.body});
    }
    if(!req.query.from)
    {
        return res.status(400).json({msg:"Query fields to be included : from", query:req.query});
    }
    electionQuery = {};
    electionQuery._id = ObjectId(req.params.id);
    Election.find(electionQuery).then((elections) => {
        if(elections.length === 0)
        {
            return res.status(400).json({msg:"Invalid election ID"});
        }
        var adminQuery = {};
        adminQuery._id = ObjectId(req.query.from);
        Admin.find(adminQuery).then((admins) => {
            if(admins.length === 0)
            {
                return res.status(400).json({msg:"Invalid from admin ID"});
            }
            var fromObj = {};
            fromObj.from = admins[0].Public_Key;
            BlockchainApp.initBlockchainServer(elections[0].Port);
            var electionContract = BlockchainApp.getSmartContract();
            electionContract.deployed().then((instance) => {
                instance.setVoteCountDate(req.body.Vote_Count_Start_Datetime, req.body.Vote_Count_End_Datetime, fromObj).then(() => {
                    var electionUpdate = {};
                    electionUpdate.Vote_Count_Start_Datetime = req.body.Vote_Count_Start_Datetime;
                    electionUpdate.Vote_Count_End_Datetime = req.body.Vote_Count_End_Datetime;
                    Election.updateOne(electionQuery,electionUpdate, (err) => {
                        if(err)
                        {
                            return res.status(500).json({msg:"Some problem occurred while vote counting date in database"});
                        }
                        return res.status(200).json({msg:"Vote counting date set successfully", data:req.body});
                    });
                }).catch((err) => {
                    console.log(err);
                    return res.status(500).json({msg:"Problem occurred while trying set vote counting date in blockchain"});
                });
            }).catch((err) => {
            console.log(err);
            return res.status(500).json({msg:"Problem occurred while trying to deploy smart contract"});
            });

        }).catch((err) => {
            console.log(err);
            return res.status(500).json({msg:"Problem occurred while trying to retrieve admins from database"});
        });
    }).catch((err) => {
        console.log(err);
        return res.status(500).json({msg:"Problem occurred while trying to retrieve elections from database"});
    });
});

router.delete('/:id', (req,res) => {
    electionObj = {};
    electionObj._id = ObjectId(req.params.id);
    Election.remove(electionObj).then((data) => {
        var responseObj = {};
        responseObj.msg = "Election deleted successfully";
        responseObj.details = data;
        res.status(200).json(responseObj);
    }).catch((err) => {
        console.log(err);
        return res.status(500).json({msg:"Internal Server Error"});
    });
});

module.exports = router;